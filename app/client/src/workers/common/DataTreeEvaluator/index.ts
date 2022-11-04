import {
  DependencyMap,
  EvalError,
  EvalErrorTypes,
  EvaluationError,
  getDynamicBindings,
  getEntityDynamicBindingPathList,
  getEvalErrorPath,
  getEvalValuePath,
  isChildPropertyPath,
  isPathADynamicBinding,
  isPathADynamicTrigger,
  PropertyEvaluationErrorType,
} from "utils/DynamicBindingUtils";
import { WidgetTypeConfigMap } from "utils/WidgetFactory";
import {
  DataTree,
  DataTreeAction,
  DataTreeEntity,
  DataTreeJSAction,
  DataTreeWidget,
  EntityConfigCollection,
  EvalTree,
  EvaluationSubstitutionType,
  PrivateWidgets,
} from "entities/DataTree/dataTreeFactory";
import {
  addDependantsOfNestedPropertyPaths,
  addErrorToEntityProperty,
  convertPathToString,
  CrashingError,
  DataTreeDiff,
  getEntityNameAndPropertyPath,
  getImmediateParentsOfPropertyPaths,
  isAction,
  isDynamicLeaf,
  isJSAction,
  isWidget,
  removeFunctions,
  translateDiffEventToDataTreeDiffEvent,
  trimDependantChangePaths,
  overrideWidgetProperties,
  getAllPaths,
} from "workers/Evaluation/evaluationUtils";
import {
  difference,
  flatten,
  get,
  isEmpty,
  isFunction,
  isObject,
  merge,
  set,
  union,
  unset,
} from "lodash";

import { applyChange, Diff, diff } from "deep-diff";
import toposort from "toposort";
import {
  EXECUTION_PARAM_KEY,
  EXECUTION_PARAM_REFERENCE_REGEX,
  THIS_DOT_PARAMS_KEY,
} from "constants/AppsmithActionConstants/ActionConstants";
import { DATA_BIND_REGEX } from "constants/BindingsConstants";
import evaluateSync, {
  EvalResult,
  EvaluateContext,
  evaluateAsync,
} from "workers/Evaluation/evaluate";
import { substituteDynamicBindingWithValues } from "workers/Evaluation/evaluationSubstitution";
import {
  Severity,
  SourceEntity,
  ENTITY_TYPE as CONSOLE_ENTITY_TYPE,
  UserLogObject,
} from "entities/AppsmithConsole";
import { error as logError } from "loglevel";
import { JSUpdate } from "utils/JSPaneUtils";

import {
  ActionValidationConfigMap,
  ValidationConfig,
} from "constants/PropertyControlConstants";
import { klona } from "klona/full";
import { EvalMetaUpdates } from "./types";
import {
  updateDependencyMap,
  createDependencyMap,
} from "workers/common/DependencyMap";
import {
  getJSEntities,
  getUpdatedLocalUnEvalTreeAfterJSUpdates,
  parseJSActions,
} from "workers/Evaluation/JSObject";
import { getFixedTimeDifference } from "./utils";
import { isJSObjectFunction } from "workers/Evaluation/JSObject/utils";
import {
  getValidatedTree,
  validateActionProperty,
  validateAndParseWidgetProperty,
} from "./validationUtils";

type SortedDependencies = Array<string>;

export default class DataTreeEvaluator {
  /**
   * dependencyMap: Maintains map of <PATH, list of paths that re-evaluates on the evaluation of the PATH>
   */
  dependencyMap: DependencyMap = {};
  sortedDependencies: SortedDependencies = [];
  inverseDependencyMap: DependencyMap = {};
  widgetConfigMap: WidgetTypeConfigMap = {};
  evalTree: EvalTree = {};
  entityConfigCollection: EntityConfigCollection = {};
  /**
   * This contains raw evaluated value without any validation or parsing.
   * This is used for revalidation as we do not store the raw validated value.
   */
  unParsedEvalTree: DataTree = {};
  allKeys: Record<string, true> = {};
  privateWidgets: PrivateWidgets = {};
  oldUnEvalTree: EvalTree = {};
  completeUnEvalTree: DataTree = {};
  errors: EvalError[] = [];
  resolvedFunctions: Record<string, any> = {};
  currentJSCollectionState: Record<string, any> = {};
  logs: unknown[] = [];
  userLogs: UserLogObject[] = [];
  allActionValidationConfig?: {
    [actionId: string]: ActionValidationConfigMap;
  };
  triggerFieldDependencyMap: DependencyMap = {};
  /**  Keeps track of all invalid references in bindings throughout the Application
   * Eg. For binding {{unknownEntity.name + Api1.name}} in Button1.text, where Api1 is present in dataTree but unknownEntity is not,
   * the map has a key-value pair of
   * {
   *  "Button1.text": [unknownEntity.name]
   * }
   */
  invalidReferencesMap: DependencyMap = {};
  /**
   * Maintains dependency of paths to re-validate on evaluation of particular property path.
   */
  validationDependencyMap: DependencyMap = {};
  sortedValidationDependencies: SortedDependencies = [];
  inverseValidationDependencyMap: DependencyMap = {};
  public hasCyclicalDependency = false;
  constructor(
    widgetConfigMap: WidgetTypeConfigMap,
    allActionValidationConfig?: {
      [actionId: string]: ActionValidationConfigMap;
    },
  ) {
    this.allActionValidationConfig = allActionValidationConfig;
    this.widgetConfigMap = widgetConfigMap;
  }

  getEvalTree() {
    return this.evalTree;
  }

  setEvalTree(evalTree: EvalTree) {
    this.evalTree = evalTree;
  }

  getUnParsedEvalTree() {
    return this.unParsedEvalTree;
  }

  setUnParsedEvalTree(unParsedEvalTree: DataTree) {
    this.unParsedEvalTree = unParsedEvalTree;
  }

  /**
   * Method to create all data required for linting and
   * evaluation of the first tree
   */
  setupFirstTree(
    unEvalTree: EvalTree,
    entityConfigCollection: EntityConfigCollection,
  ): {
    jsUpdates: Record<string, JSUpdate>;
    evalOrder: string[];
    lintOrder: string[];
  } {
    const totalFirstTreeSetupStartTime = performance.now();
    // cloneDeep will make sure not to omit key which has value as undefined.
    const firstCloneStartTime = performance.now();
    const completeUnEvalTree = merge(
      {},
      unEvalTree,
      entityConfigCollection,
    ) as DataTree;
    this.completeUnEvalTree = completeUnEvalTree;
    this.oldUnEvalTree = klona(unEvalTree);

    const firstCloneEndTime = performance.now();

    let jsUpdates: Record<string, JSUpdate> = {};
    //parse js collection to get functions
    //save current state of js collection action and variables to be added to uneval tree
    //save functions in resolveFunctions (as functions) to be executed as functions are not allowed in evalTree
    //and functions are saved in dataTree as strings
    const parsedCollections = parseJSActions(this, this.completeUnEvalTree);
    jsUpdates = parsedCollections.jsUpdates;
    console.log("$$$-this.completeUnEvalTree", this.completeUnEvalTree);
    unEvalTree = getUpdatedLocalUnEvalTreeAfterJSUpdates(
      jsUpdates,
      unEvalTree,
      this.completeUnEvalTree,
    );
    const allKeysGenerationStartTime = performance.now();
    // set All keys
    this.allKeys = getAllPaths(unEvalTree);
    const allKeysGenerationEndTime = performance.now();

    const createDependencyMapStartTime = performance.now();
    // Create dependency map
    const {
      dependencyMap,
      invalidReferencesMap,
      triggerFieldDependencyMap,
      validationDependencyMap,
    } = createDependencyMap(this, this.completeUnEvalTree);
    const createDependencyMapEndTime = performance.now();

    this.dependencyMap = dependencyMap;
    this.triggerFieldDependencyMap = triggerFieldDependencyMap;
    this.invalidReferencesMap = invalidReferencesMap;
    this.validationDependencyMap = validationDependencyMap;
    const sortDependenciesStartTime = performance.now();
    // Sort
    this.sortedDependencies = this.sortDependencies(this.dependencyMap);
    this.sortedValidationDependencies = this.sortDependencies(
      validationDependencyMap,
    );
    const sortDependenciesEndTime = performance.now();

    const inverseDependencyGenerationStartTime = performance.now();
    // Inverse
    this.inverseDependencyMap = this.getInverseDependencyTree({
      dependencyMap,
      sortedDependencies: this.sortedDependencies,
    });
    this.inverseValidationDependencyMap = this.getInverseDependencyTree({
      dependencyMap: validationDependencyMap,
      sortedDependencies: this.sortedValidationDependencies,
    });
    const inverseDependencyGenerationEndTime = performance.now();

    const secondCloneStartTime = performance.now();
    this.oldUnEvalTree = klona(unEvalTree);
    const secondCloneEndTime = performance.now();

    const totalFirstTreeSetupEndTime = performance.now();

    const timeTakenForSetupFirstTree = {
      total: getFixedTimeDifference(
        totalFirstTreeSetupEndTime,
        totalFirstTreeSetupStartTime,
      ),
      clone: getFixedTimeDifference(
        firstCloneEndTime + secondCloneEndTime,
        firstCloneStartTime + secondCloneStartTime,
      ),
      allKeys: getFixedTimeDifference(
        allKeysGenerationEndTime,
        allKeysGenerationStartTime,
      ),
      createDependencyMap: getFixedTimeDifference(
        createDependencyMapEndTime,
        createDependencyMapStartTime,
      ),
      sortDependencies: getFixedTimeDifference(
        sortDependenciesEndTime,
        sortDependenciesStartTime,
      ),
      inverseDependency: getFixedTimeDifference(
        inverseDependencyGenerationEndTime,
        inverseDependencyGenerationStartTime,
      ),
    };
    this.logs.push({ timeTakenForSetupFirstTree });

    return {
      jsUpdates,
      evalOrder: this.sortedDependencies,
      lintOrder: this.sortedDependencies,
    };
  }

  evalAndValidateFirstTree(): {
    evalTree: EvalTree;
    evalMetaUpdates: EvalMetaUpdates;
  } {
    const evaluationStartTime = performance.now();
    // Evaluate
    const { evalMetaUpdates, evaluatedTree } = this.evaluateTree(
      this.oldUnEvalTree,
      this.resolvedFunctions,
      this.sortedDependencies,
    );
    const evaluationEndTime = performance.now();

    const validationStartTime = performance.now();
    // Validate Widgets
    this.setEvalTree(getValidatedTree(evaluatedTree));
    const validationEndTime = performance.now();

    const timeTakenForEvalAndValidateFirstTree = {
      evaluation: getFixedTimeDifference(
        evaluationEndTime,
        evaluationStartTime,
      ),
      validation: getFixedTimeDifference(
        validationEndTime,
        validationStartTime,
      ),
    };
    this.logs.push({ timeTakenForEvalAndValidateFirstTree });

    return {
      evalTree: this.getEvalTree(),
      evalMetaUpdates,
    };
  }

  updateLocalUnEvalTree(dataTree: EvalTree) {
    //add functions and variables to unevalTree
    Object.keys(this.currentJSCollectionState).forEach((update) => {
      const updates = this.currentJSCollectionState[update];
      if (!!dataTree[update]) {
        Object.keys(updates).forEach((key) => {
          const data = get(dataTree, `${update}.${key}.data`, undefined);
          if (isJSObjectFunction(dataTree, update, key)) {
            set(dataTree, `${update}.${key}`, new String(updates[key]));
            set(dataTree, `${update}.${key}.data`, data);
          } else {
            set(dataTree, `${update}.${key}`, updates[key]);
          }
        });
      }
    });
  }

  /**
   * Method to create all data required for linting and
   * evaluation of the updated tree
   */

  setupUpdateTree(
    unEvalTree: EvalTree,
    entityConfigCollection: EntityConfigCollection,
  ): {
    unEvalUpdates: DataTreeDiff[];
    evalOrder: string[];
    lintOrder: string[];
    jsUpdates: Record<string, JSUpdate>;
    nonDynamicFieldValidationOrder: string[];
  } {
    const totalUpdateTreeSetupStartTime = performance.now();
    const completeUnEvalTree = merge(
      {},
      unEvalTree,
      entityConfigCollection,
    ) as DataTree;
    this.completeUnEvalTree = completeUnEvalTree;
    const localUnEvalTree = Object.assign({}, completeUnEvalTree);
    let jsUpdates: Record<string, JSUpdate> = {};
    const diffCheckTimeStartTime = performance.now();
    //update uneval tree from previously saved current state of collection
    this.updateLocalUnEvalTree(unEvalTree);
    //get difference in js collection body to be parsed
    const oldUnEvalTreeJSCollections = getJSEntities(this.oldUnEvalTree);
    const localUnEvalTreeJSCollection = getJSEntities(unEvalTree);
    const jsDifferences: Diff<
      Record<string, DataTreeJSAction>,
      Record<string, DataTreeJSAction>
    >[] = diff(oldUnEvalTreeJSCollections, localUnEvalTreeJSCollection) || [];
    const jsTranslatedDiffs = flatten(
      jsDifferences.map((diff) =>
        translateDiffEventToDataTreeDiffEvent(diff, localUnEvalTree),
      ),
    );
    //save parsed functions in resolveJSFunctions, update current state of js collection
    const parsedCollections = parseJSActions(
      this,
      localUnEvalTree,
      jsTranslatedDiffs,
      this.completeUnEvalTree,
    );

    jsUpdates = parsedCollections.jsUpdates;
    //update local data tree if js body has updated (remove/update/add js functions or variables)
    console.log("$$$-this.completeUnEvalTree", this.completeUnEvalTree);
    unEvalTree = getUpdatedLocalUnEvalTreeAfterJSUpdates(
      jsUpdates,
      unEvalTree,
      this.completeUnEvalTree,
    );

    const differences: Diff<EvalTree, EvalTree>[] =
      diff(this.oldUnEvalTree, unEvalTree) || [];
    // Since eval tree is listening to possible events that don't cause differences
    // We want to check if no diffs are present and bail out early
    if (differences.length === 0) {
      return {
        unEvalUpdates: [],
        evalOrder: [],
        lintOrder: [],
        jsUpdates: {},
        nonDynamicFieldValidationOrder: [],
      };
    }
    //find all differences which can lead to updating of dependency map
    const translatedDiffs = flatten(
      differences.map((diff) =>
        translateDiffEventToDataTreeDiffEvent(diff, localUnEvalTree),
      ),
    );
    const diffCheckTimeStopTime = performance.now();
    this.logs.push({
      differences,
      translatedDiffs,
    });
    const updateDependencyStartTime = performance.now();
    // Find all the paths that have changed as part of the difference and update the
    // global dependency map if an existing dynamic binding has now become legal
    const {
      dependenciesOfRemovedPaths,
      extraPathsToLint,
      removedPaths,
    } = updateDependencyMap({
      dataTreeEvalRef: this,
      translatedDiffs,
      unEvalDataTree: completeUnEvalTree,
    });
    const updateDependencyEndTime = performance.now();

    this.applyDifferencesToEvalTree(differences);

    const calculateSortOrderStartTime = performance.now();
    const subTreeSortOrder: string[] = this.calculateSubTreeSortOrder(
      differences,
      dependenciesOfRemovedPaths,
      removedPaths,
      localUnEvalTree,
    );
    const calculateSortOrderEndTime = performance.now();
    // Remove anything from the sort order that is not a dynamic leaf since only those need evaluation
    const evaluationOrder: string[] = [];
    let nonDynamicFieldValidationOrderSet = new Set<string>();

    subTreeSortOrder.filter((propertyPath) => {
      // We are setting all values from our uneval tree to the old eval tree we have
      // So that the actual uneval value can be evaluated
      if (isDynamicLeaf(localUnEvalTree, propertyPath)) {
        const unEvalPropValue = get(localUnEvalTree, propertyPath);
        const evalPropValue = get(this.evalTree, propertyPath);
        if (!isFunction(evalPropValue)) {
          set(this.evalTree, propertyPath, unEvalPropValue);
        }
        evaluationOrder.push(propertyPath);
      } else {
        /**
         * if the non dynamic value changes that should trigger revalidation like tabs.tabsObj then we store it in nonDynamicFieldValidationOrderSet
         */
        if (this.inverseValidationDependencyMap[propertyPath]) {
          nonDynamicFieldValidationOrderSet = new Set([
            ...nonDynamicFieldValidationOrderSet,
            propertyPath,
          ]);
        }
      }
    });

    this.logs.push({
      sortedDependencies: this.sortedDependencies,
      inverse: this.inverseDependencyMap,
      updatedDependencyMap: this.dependencyMap,
      evaluationOrder: evaluationOrder,
    });

    // Remove any deleted paths from the eval tree
    removedPaths.forEach((removedPath) => {
      unset(this.evalTree, removedPath);
    });

    const cloneStartTime = performance.now();
    // TODO: For some reason we are passing some reference which are getting mutated.
    // Need to check why big api responses are getting split between two eval runs
    this.oldUnEvalTree = klona(unEvalTree);
    const cloneEndTime = performance.now();

    const totalUpdateTreeSetupEndTime = performance.now();

    const timeTakenForSetupUpdateTree = {
      total: getFixedTimeDifference(
        totalUpdateTreeSetupEndTime,
        totalUpdateTreeSetupStartTime,
      ),
      updateDependencyMap: getFixedTimeDifference(
        updateDependencyEndTime,
        updateDependencyStartTime,
      ),
      calculateSubTreeSortOrder: getFixedTimeDifference(
        calculateSortOrderEndTime,
        calculateSortOrderStartTime,
      ),
      findDifferences: getFixedTimeDifference(
        diffCheckTimeStopTime,
        diffCheckTimeStartTime,
      ),
      clone: getFixedTimeDifference(cloneEndTime, cloneStartTime),
    };

    this.logs.push({ timeTakenForSetupUpdateTree });

    return {
      unEvalUpdates: translatedDiffs,
      evalOrder: evaluationOrder,
      lintOrder: union(evaluationOrder, extraPathsToLint),
      jsUpdates,
      nonDynamicFieldValidationOrder: Array.from(
        nonDynamicFieldValidationOrderSet,
      ),
    };
  }

  evalAndValidateSubTree(
    evaluationOrder: string[],
    nonDynamicFieldValidationOrder: string[],
  ): {
    evalMetaUpdates: EvalMetaUpdates;
  } {
    const evaluationStartTime = performance.now();
    const { evalMetaUpdates, evaluatedTree: newEvalTree } = this.evaluateTree(
      this.evalTree,

      this.resolvedFunctions,
      evaluationOrder,
      { skipRevalidation: false },
    );
    const evaluationEndTime = performance.now();
    const reValidateStartTime = performance.now();
    this.reValidateTree(nonDynamicFieldValidationOrder, newEvalTree);
    const reValidateEndTime = performance.now();
    this.setEvalTree(newEvalTree);
    const timeTakenForEvalAndValidateSubTree = {
      evaluation: getFixedTimeDifference(
        evaluationEndTime,
        evaluationStartTime,
      ),
      revalidation: getFixedTimeDifference(
        reValidateEndTime,
        reValidateStartTime,
      ),
    };
    this.logs.push({ timeTakenForEvalAndValidateSubTree });
    return {
      evalMetaUpdates,
    };
  }

  getCompleteSortOrder(
    changes: Array<string>,
    inverseMap: DependencyMap,
  ): Array<string> {
    let finalSortOrder: Array<string> = [];
    let computeSortOrder = true;
    // Initialize parents with the current sent of property paths that need to be evaluated
    let parents = changes;
    let subSortOrderArray: Array<string>;
    while (computeSortOrder) {
      // Get all the nodes that would be impacted by the evaluation of the nodes in parents array in sorted order
      subSortOrderArray = this.getEvaluationSortOrder(parents, inverseMap);

      // Add all the sorted nodes in the final list
      finalSortOrder = [...finalSortOrder, ...subSortOrderArray];

      parents = getImmediateParentsOfPropertyPaths(subSortOrderArray);
      // If we find parents of the property paths in the sorted array, we should continue finding all the nodes dependent
      // on the parents
      computeSortOrder = parents.length > 0;
    }

    // Remove duplicates from this list. Since we explicitly walk down the tree and implicitly (by fetching parents) walk
    // up the tree, there are bound to be many duplicates.
    const uniqueKeysInSortOrder = new Set(finalSortOrder);

    // if a property path evaluation gets triggered by diff top order changes
    // this could lead to incorrect sort order in spite of the bfs traversal
    const sortOrderPropertyPaths: string[] = [];
    this.sortedDependencies.forEach((path) => {
      if (uniqueKeysInSortOrder.has(path)) {
        sortOrderPropertyPaths.push(path);
        // remove from the uniqueKeysInSortOrder
        uniqueKeysInSortOrder.delete(path);
      }
    });
    // Add any remaining paths in the uniqueKeysInSortOrder
    const completeSortOrder = [
      ...Array.from(uniqueKeysInSortOrder),
      ...sortOrderPropertyPaths,
    ];

    //Trim this list to now remove the property paths which are simply entity names
    const finalSortOrderArray: Array<string> = [];
    completeSortOrder.forEach((propertyPath) => {
      const lastIndexOfDot = propertyPath.lastIndexOf(".");
      // Only do this for property paths and not the entity themselves
      if (lastIndexOfDot !== -1) {
        finalSortOrderArray.push(propertyPath);
      }
    });

    return finalSortOrderArray;
  }

  getEvaluationSortOrder(
    changes: Array<string>,
    inverseMap: DependencyMap,
  ): Array<string> {
    const sortOrder: Array<string> = [...changes];
    let iterator = 0;
    while (iterator < sortOrder.length) {
      // Find all the nodes who are to be evaluated when sortOrder[iterator] changes
      const newNodes = inverseMap[sortOrder[iterator]];

      // If we find more nodes that would be impacted by the evaluation of the node being investigated
      // we add these to the sort order.
      if (newNodes) {
        newNodes.forEach((toBeEvaluatedNode) => {
          // Only add the nodes if they haven't been already added for evaluation in the list. Since we are doing
          // breadth first traversal, we should be safe in not changing the evaluation order and adding this now at this
          // point instead of the previous index found.
          if (!sortOrder.includes(toBeEvaluatedNode)) {
            sortOrder.push(toBeEvaluatedNode);
          }
        });
      }
      iterator++;
    }
    return sortOrder;
  }

  getPrivateWidgets(dataTree: DataTree): PrivateWidgets {
    let privateWidgets: PrivateWidgets = {};
    Object.keys(dataTree).forEach((entityName) => {
      const entity = dataTree[entityName];
      if (isWidget(entity) && !isEmpty(entity.privateWidgets)) {
        privateWidgets = {
          ...privateWidgets,
          ...entity.privateWidgets,
        };
      }
    });
    return privateWidgets;
  }

  evaluateTree(
    oldUnevalTree: EvalTree,
    resolvedFunctions: Record<string, any>,
    sortedDependencies: Array<string>,
    option = { skipRevalidation: true },
  ): {
    evaluatedTree: EvalTree;
    evalMetaUpdates: EvalMetaUpdates;
  } {
    const tree = klona(oldUnevalTree);
    const evalMetaUpdates: EvalMetaUpdates = [];
    try {
      const evaluatedTree = sortedDependencies.reduce(
        (currentTree: EvalTree, fullPropertyPath: string) => {
          const { entityName, propertyPath } = getEntityNameAndPropertyPath(
            fullPropertyPath,
          );
          const entity = this.entityConfigCollection[entityName] as
            | DataTreeWidget
            | DataTreeAction;
          const unEvalPropertyValue = get(currentTree as any, fullPropertyPath);

          const isADynamicBindingPath =
            (isAction(entity) || isWidget(entity) || isJSAction(entity)) &&
            isPathADynamicBinding(entity, propertyPath);
          const isATriggerPath =
            isWidget(entity) && isPathADynamicTrigger(entity, propertyPath);
          let evalPropertyValue;
          const requiresEval =
            isADynamicBindingPath &&
            !isATriggerPath &&
            (isDynamicValue(unEvalPropertyValue) || isJSAction(entity));
          if (propertyPath) {
            set(currentTree, getEvalErrorPath(fullPropertyPath), []);
          }
          if (requiresEval) {
            const evaluationSubstitutionType =
              entity.reactivePaths[propertyPath] ||
              EvaluationSubstitutionType.TEMPLATE;

            const contextData: EvaluateContext = {};
            if (isAction(entity)) {
              contextData.thisContext = {
                params: {},
              };
            }
            try {
              evalPropertyValue = this.getDynamicValue(
                unEvalPropertyValue,
                currentTree,
                resolvedFunctions,
                evaluationSubstitutionType,
                contextData,
                undefined,
                fullPropertyPath,
              );
            } catch (error) {
              this.errors.push({
                type: EvalErrorTypes.EVAL_PROPERTY_ERROR,
                message: (error as Error).message,
                context: {
                  propertyPath: fullPropertyPath,
                },
              });
              evalPropertyValue = undefined;
            }
          } else {
            evalPropertyValue = unEvalPropertyValue;
          }
          if (isWidget(entity) && !isATriggerPath) {
            if (propertyPath) {
              const parsedValue = validateAndParseWidgetProperty({
                fullPropertyPath,
                widget: entity,
                currentTree,
                evalPropertyValue,
                unEvalPropertyValue,
              });

              this.setParsedValue({
                currentTree,
                entity,
                evalMetaUpdates,
                fullPropertyPath,
                parsedValue,
                propertyPath,
                evalPropertyValue,
              });

              if (!option.skipRevalidation) {
                this.reValidateWidgetDependentProperty({
                  fullPropertyPath,
                  widget: entity,
                  currentTree,
                });
              }

              return currentTree;
            }
            return set(currentTree, fullPropertyPath, evalPropertyValue);
          } else if (isATriggerPath) {
            return currentTree;
          } else if (isAction(entity)) {
            if (this.allActionValidationConfig) {
              const configProperty = propertyPath.replace(
                "config",
                "actionConfiguration",
              );
              const validationConfig =
                !!this.allActionValidationConfig[entity.actionId] &&
                this.allActionValidationConfig[entity.actionId][configProperty];
              if (!!validationConfig && !isEmpty(validationConfig)) {
                this.validateActionProperty(
                  fullPropertyPath,
                  entity,
                  currentTree,
                  evalPropertyValue,
                  unEvalPropertyValue,
                  validationConfig,
                );
              }
            }
            const safeEvaluatedValue = removeFunctions(evalPropertyValue);
            set(
              currentTree,
              getEvalValuePath(fullPropertyPath),
              safeEvaluatedValue,
            );
            set(currentTree, fullPropertyPath, evalPropertyValue);
            return currentTree;
          } else if (isJSAction(entity)) {
            const variableList: Array<string> = get(entity, "variables") || [];
            if (variableList.indexOf(propertyPath) > -1) {
              const currentEvaluatedValue = get(
                currentTree,
                getEvalValuePath(fullPropertyPath, {
                  isPopulated: true,
                  fullPath: true,
                }),
              );
              if (!currentEvaluatedValue) {
                set(
                  currentTree,
                  getEvalValuePath(fullPropertyPath, {
                    isPopulated: true,
                    fullPath: true,
                  }),
                  evalPropertyValue,
                );
                set(currentTree, fullPropertyPath, evalPropertyValue);
              } else {
                set(currentTree, fullPropertyPath, currentEvaluatedValue);
              }
            }
            return currentTree;
          } else {
            return set(currentTree, fullPropertyPath, evalPropertyValue);
          }
        },
        tree,
      );
      return { evaluatedTree, evalMetaUpdates };
    } catch (error) {
      this.errors.push({
        type: EvalErrorTypes.EVAL_TREE_ERROR,
        message: (error as Error).message,
      });
      return { evaluatedTree: tree, evalMetaUpdates };
    }
  }

  setAllActionValidationConfig(allActionValidationConfig: {
    [actionId: string]: ActionValidationConfigMap;
  }): void {
    this.allActionValidationConfig = allActionValidationConfig;
  }

  sortDependencies(
    dependencyMap: DependencyMap,
    diffs?: (DataTreeDiff | DataTreeDiff[])[],
  ): Array<string> {
    /**
     * dependencyTree : Array<[Node, dependentNode]>
     */
    const dependencyTree: Array<[string, string]> = [];
    Object.keys(dependencyMap).forEach((key: string) => {
      if (dependencyMap[key].length) {
        dependencyMap[key].forEach((dep) => dependencyTree.push([key, dep]));
      } else {
        // Set no dependency
        dependencyTree.push([key, ""]);
      }
    });

    try {
      return toposort(dependencyTree)
        .reverse()
        .filter((d) => !!d);
    } catch (error) {
      // Cyclic dependency found. Extract all node and entity type
      const cyclicNodes = (error as Error).message.match(
        new RegExp('Cyclic dependency, node was:"(.*)"'),
      );

      const node = cyclicNodes?.length ? cyclicNodes[1] : "";

      let entityType = "UNKNOWN";
      const entityName = node.split(".")[0];
      const entity = get(this.oldUnEvalTree, entityName) as DataTreeEntity;
      if (entity && isWidget(entity)) {
        entityType = entity.type;
      } else if (entity && isAction(entity)) {
        entityType = entity.pluginType;
      } else if (entity && isJSAction(entity)) {
        entityType = entity.ENTITY_TYPE;
      }
      this.errors.push({
        type: EvalErrorTypes.CYCLICAL_DEPENDENCY_ERROR,
        message: "Cyclic dependency found while evaluating.",
        context: {
          node,
          entityType,
          dependencyMap,
          diffs,
        },
      });
      logError("CYCLICAL DEPENDENCY MAP", dependencyMap);
      this.hasCyclicalDependency = true;
      throw new CrashingError((error as Error).message);
    }
  }

  getDynamicValue(
    dynamicBinding: string,
    data: EvalTree,
    resolvedFunctions: Record<string, any>,
    evaluationSubstitutionType: EvaluationSubstitutionType,
    contextData?: EvaluateContext,
    callBackData?: Array<any>,
    fullPropertyPath?: string,
  ) {
    // Get the {{binding}} bound values
    let entity: DataTreeEntity | undefined = undefined;
    let propertyPath: string;
    if (fullPropertyPath) {
      const entityName = fullPropertyPath.split(".")[0];
      propertyPath = fullPropertyPath.split(".")[1];
      entity = data[entityName];
    }
    // Get the {{binding}} bound values
    const { jsSnippets, stringSegments } = getDynamicBindings(
      dynamicBinding,
      entity,
    );
    if (stringSegments.length) {
      // Get the Data Tree value of those "binding "paths
      const values = jsSnippets.map((jsSnippet, index) => {
        const toBeSentForEval =
          entity && isJSAction(entity) && propertyPath === "body"
            ? jsSnippet.replace(/export default/g, "")
            : jsSnippet;
        if (jsSnippet) {
          const result = this.evaluateDynamicBoundValue(
            toBeSentForEval,
            data,
            resolvedFunctions,
            !!entity && isJSAction(entity),
            contextData,
            callBackData,
            fullPropertyPath?.includes("body") ||
              !toBeSentForEval.includes("console."),
          );
          if (fullPropertyPath && result.errors.length) {
            addErrorToEntityProperty(result.errors, data, fullPropertyPath);
          }
          // if there are any console outputs found from the evaluation, extract them and add them to the logs array
          if (
            !!entity &&
            !!result.logs &&
            result.logs.length > 0 &&
            !propertyPath.includes("body")
          ) {
            let type = CONSOLE_ENTITY_TYPE.WIDGET;
            let id = "";

            // extracting the id and type of the entity from the entity for logs object
            if (isWidget(entity)) {
              type = CONSOLE_ENTITY_TYPE.WIDGET;
              id = entity.widgetId;
            } else if (isAction(entity)) {
              type = CONSOLE_ENTITY_TYPE.ACTION;
              id = entity.actionId;
            } else if (isJSAction(entity)) {
              type = CONSOLE_ENTITY_TYPE.JSACTION;
              id = entity.actionId;
            }

            // This is the object that will help to associate the log with the origin entity
            const source: SourceEntity = {
              type,
              name: fullPropertyPath?.split(".")[0] || "Widget",
              id,
            };
            this.userLogs.push({
              logObject: result.logs,
              source,
            });
          }
          return result.result;
        } else {
          return stringSegments[index];
        }
      });

      // We don't need to substitute template of the result if only one binding exists
      // But it should not be of prepared statements since that does need a string
      if (
        stringSegments.length === 1 &&
        evaluationSubstitutionType !== EvaluationSubstitutionType.PARAMETER
      ) {
        return values[0];
      }
      try {
        // else return a combined value according to the evaluation type
        return substituteDynamicBindingWithValues(
          dynamicBinding,
          stringSegments,
          values,
          evaluationSubstitutionType,
        );
      } catch (error) {
        if (fullPropertyPath) {
          addErrorToEntityProperty(
            [
              {
                raw: dynamicBinding,
                errorType: PropertyEvaluationErrorType.PARSE,
                errorMessage: (error as Error).message,
                severity: Severity.ERROR,
              },
            ],
            data,
            fullPropertyPath,
          );
        }
        return undefined;
      }
    }
    return undefined;
  }

  async evaluateTriggers(
    userScript: string,
    dataTree: EvalTree,
    requestId: string,
    resolvedFunctions: Record<string, any>,
    callbackData: Array<unknown>,
    context?: EvaluateContext,
  ) {
    const { jsSnippets } = getDynamicBindings(userScript);
    return evaluateAsync(
      jsSnippets[0] || userScript,
      dataTree,
      requestId,
      resolvedFunctions,
      context,
      callbackData,
    );
  }

  // Paths are expected to have "{name}.{path}" signature
  // Also returns any action triggers found after evaluating value
  evaluateDynamicBoundValue(
    js: string,
    data: EvalTree,
    resolvedFunctions: Record<string, any>,
    createGlobalData: boolean,
    contextData?: EvaluateContext,
    callbackData?: Array<any>,
    skipUserLogsOperations = false,
  ): EvalResult {
    try {
      return evaluateSync(
        js,
        data,
        resolvedFunctions,
        createGlobalData,
        contextData,
        callbackData,
        skipUserLogsOperations,
      );
    } catch (error) {
      return {
        result: undefined,
        errors: [
          {
            errorType: PropertyEvaluationErrorType.PARSE,
            raw: js,
            severity: Severity.ERROR,
            errorMessage: (error as Error).message,
          },
        ],
      };
    }
  }

  setParsedValue({
    currentTree,
    entity,
    evalMetaUpdates,
    evalPropertyValue,
    fullPropertyPath,
    parsedValue,
    propertyPath,
  }: {
    currentTree: EvalTree;
    entity: DataTreeWidget;
    evalMetaUpdates: EvalMetaUpdates;
    fullPropertyPath: string;
    parsedValue: unknown;
    propertyPath: string;
    evalPropertyValue: unknown;
  }) {
    const overwriteObj = overrideWidgetProperties({
      entity,
      propertyPath,
      value: parsedValue,
      currentTree,
      evalMetaUpdates,
    });

    if (overwriteObj && overwriteObj.overwriteParsedValue) {
      parsedValue = overwriteObj.newValue;
    }
    // setting parseValue in dataTree
    set(currentTree, fullPropertyPath, parsedValue);
    // setting evalPropertyValue in unParsedEvalTree
    set(this.getUnParsedEvalTree(), fullPropertyPath, evalPropertyValue);
  }

  reValidateWidgetDependentProperty({
    currentTree,
    fullPropertyPath,
    widget,
  }: {
    fullPropertyPath: string;
    widget: DataTreeWidget;
    currentTree: EvalTree;
  }) {
    if (this.inverseValidationDependencyMap[fullPropertyPath]) {
      const pathsToRevalidate = this.inverseValidationDependencyMap[
        fullPropertyPath
      ];
      pathsToRevalidate.forEach((fullPath) => {
        validateAndParseWidgetProperty({
          fullPropertyPath: fullPath,
          widget,
          currentTree: currentTree || this.evalTree,
          // we supply non-transformed evaluated value
          evalPropertyValue: get(this.getUnParsedEvalTree(), fullPath),
          unEvalPropertyValue: (get(
            this.oldUnEvalTree,
            fullPath,
          ) as unknown) as string,
        });
      });
    }
  }

  reValidateTree(
    nonDynamicFieldValidationOrder: string[],
    currentTree: EvalTree,
  ) {
    nonDynamicFieldValidationOrder.forEach((fullPropertyPath) => {
      const { entityName, propertyPath } = getEntityNameAndPropertyPath(
        fullPropertyPath,
      );
      const entity = currentTree[entityName];
      if (isWidget(entity) && !isPathADynamicTrigger(entity, propertyPath)) {
        this.reValidateWidgetDependentProperty({
          widget: entity,
          fullPropertyPath,
          currentTree,
        });
      }
    });
  }

  // validates the user input saved as action property based on a validationConfig
  validateActionProperty(
    fullPropertyPath: string,
    action: DataTreeAction,
    currentTree: EvalTree,
    evalPropertyValue: any,
    unEvalPropertyValue: string,
    validationConfig: ValidationConfig,
  ) {
    if (evalPropertyValue && validationConfig) {
      // runs VALIDATOR function and returns errors
      const { isValid, messages } = validateActionProperty(
        validationConfig,
        evalPropertyValue,
      );
      if (!isValid) {
        const evalErrors: EvaluationError[] =
          messages?.map((message: string) => {
            return {
              raw: unEvalPropertyValue,
              errorMessage: message || "",
              errorType: PropertyEvaluationErrorType.VALIDATION,
              severity: Severity.ERROR,
            };
          }) ?? [];
        // saves error in dataTree at fullPropertyPath
        // Later errors can consumed by the forms and debugger
        addErrorToEntityProperty(evalErrors, currentTree, fullPropertyPath);
      }
    }
  }

  applyDifferencesToEvalTree(differences: Diff<any, any>[]) {
    for (const d of differences) {
      if (!Array.isArray(d.path) || d.path.length === 0) continue; // Null check for typescript
      // Apply the changes into the evalTree so that it gets the latest changes
      applyChange(this.evalTree, undefined, d);
    }
  }

  calculateSubTreeSortOrder(
    differences: Diff<any, any>[],
    dependenciesOfRemovedPaths: Array<string>,
    removedPaths: Array<string>,
    unEvalTree: DataTree,
  ) {
    const changePaths: Set<string> = new Set(dependenciesOfRemovedPaths);
    for (const d of differences) {
      if (!Array.isArray(d.path) || d.path.length === 0) continue; // Null check for typescript
      changePaths.add(convertPathToString(d.path));
      // If this is a property path change, simply add for evaluation and move on
      if (!isDynamicLeaf(unEvalTree, convertPathToString(d.path))) {
        // A parent level property has been added or deleted
        /**
         * We want to add all pre-existing dynamic and static bindings in dynamic paths of this entity to get evaluated and validated.
         * Example:
         * - Table1.tableData = {{Api1.data}}
         * - Api1 gets created.
         * - This function gets called with a diff {path:["Api1"]}
         * We want to add `Api.data` to changedPaths so that `Table1.tableData` can be discovered below.
         */
        const entityName = d.path[0];
        const entity = unEvalTree[entityName];
        if (!entity) {
          continue;
        }
        if (!isAction(entity) && !isWidget(entity) && !isJSAction(entity)) {
          continue;
        }
        let entityDynamicBindingPaths: string[] = [];
        if (isAction(entity)) {
          const entityDynamicBindingPathList = getEntityDynamicBindingPathList(
            entity,
          );
          entityDynamicBindingPaths = entityDynamicBindingPathList.map(
            (path) => {
              return path.key;
            },
          );
        }
        const parentPropertyPath = convertPathToString(d.path);
        Object.keys(entity.reactivePaths).forEach((relativePath) => {
          const childPropertyPath = `${entityName}.${relativePath}`;
          // Check if relative path has dynamic binding
          if (
            entityDynamicBindingPaths &&
            entityDynamicBindingPaths.length &&
            entityDynamicBindingPaths.includes(relativePath)
          ) {
            changePaths.add(childPropertyPath);
          }
          if (isChildPropertyPath(parentPropertyPath, childPropertyPath)) {
            changePaths.add(childPropertyPath);
          }
        });
      }
    }

    // If a nested property path has changed and someone (say x) is dependent on the parent of the said property,
    // x must also be evaluated. For example, the following relationship exists in dependency map:
    // <  "Input1.defaultText" : ["Table1.selectedRow.email"] >
    // If Table1.selectedRow has changed, then Input1.defaultText must also be evaluated because Table1.selectedRow.email
    // is a nested property of Table1.selectedRow
    const changePathsWithNestedDependants = addDependantsOfNestedPropertyPaths(
      Array.from(changePaths),
      this.inverseDependencyMap,
    );

    const trimmedChangedPaths = trimDependantChangePaths(
      changePathsWithNestedDependants,
      this.dependencyMap,
    );

    // Now that we have all the root nodes which have to be evaluated, recursively find all the other paths which
    // would get impacted because they are dependent on the said root nodes and add them in order
    const completeSortOrder = this.getCompleteSortOrder(
      trimmedChangedPaths,
      this.inverseDependencyMap,
    );
    // Remove any paths that do not exist in the data tree anymore
    return difference(completeSortOrder, removedPaths);
  }

  getInverseDependencyTree(
    params = {
      dependencyMap: this.dependencyMap,
      sortedDependencies: this.sortedDependencies,
    },
  ): DependencyMap {
    const { dependencyMap, sortedDependencies } = params;
    const inverseDependencyMap: DependencyMap = {};
    sortedDependencies.forEach((propertyPath) => {
      const incomingEdges: Array<string> = dependencyMap[propertyPath];
      if (incomingEdges) {
        incomingEdges.forEach((edge) => {
          const node = inverseDependencyMap[edge];
          if (node) {
            node.push(propertyPath);
          } else {
            inverseDependencyMap[edge] = [propertyPath];
          }
        });
      }
    });
    return inverseDependencyMap;
  }

  evaluateActionBindings(
    bindings: string[],
    executionParams?: Record<string, unknown> | string,
  ) {
    // We might get execution params as an object or as a string.
    // If the user has added a proper object (valid case) it will be an object
    // If they have not added any execution params or not an object
    // it would be a string (invalid case)
    let evaluatedExecutionParams: Record<string, any> = {};
    if (executionParams && isObject(executionParams)) {
      evaluatedExecutionParams = this.getDynamicValue(
        `{{${JSON.stringify(executionParams)}}}`,
        this.evalTree,
        this.resolvedFunctions,
        EvaluationSubstitutionType.TEMPLATE,
      );
    }

    return bindings.map((binding) => {
      // Replace any reference of 'this.params' to 'executionParams' (backwards compatibility)
      // also helps with dealing with IIFE which are normal functions (not arrow)
      // because normal functions won't retain 'this' context (when executed elsewhere)
      const replacedBinding = binding.replace(
        EXECUTION_PARAM_REFERENCE_REGEX,
        EXECUTION_PARAM_KEY,
      );
      return this.getDynamicValue(
        `{{${replacedBinding}}}`,
        this.evalTree,
        this.resolvedFunctions,
        EvaluationSubstitutionType.TEMPLATE,
        // params can be accessed via "this.params" or "executionParams"
        {
          thisContext: {
            [THIS_DOT_PARAMS_KEY]: evaluatedExecutionParams,
          },
          globalContext: {
            [EXECUTION_PARAM_KEY]: evaluatedExecutionParams,
          },
        },
      );
    });
  }

  clearErrors() {
    this.errors = [];
  }
  clearLogs() {
    this.logs = [];
    this.userLogs = [];
  }
}

// TODO cryptic comment below. Dont know if we still need this. Duplicate function
// referencing DATA_BIND_REGEX fails for the value "{{Table1.tableData[Table1.selectedRowIndex]}}" if you run it multiple times and don't recreate
const isDynamicValue = (value: string): boolean => DATA_BIND_REGEX.test(value);
