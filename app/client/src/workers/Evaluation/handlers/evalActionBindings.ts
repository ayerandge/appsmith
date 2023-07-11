import { dataTreeEvaluator } from "./evalTree";
import { removeFunctions } from "@appsmith/workers/Evaluation/evaluationUtils";
import type { EvalWorkerSyncRequest } from "../types";

export default function (request: EvalWorkerSyncRequest) {
  const { data } = request;
  const { bindings, executionParams, moduleId } = data;
  if (!dataTreeEvaluator) {
    return { values: undefined, errors: [] };
  }

  const values = dataTreeEvaluator.evaluateActionBindings(
    bindings,
    executionParams,
    moduleId,
  );

  const cleanValues = removeFunctions(values);

  const errors = dataTreeEvaluator.errors;
  dataTreeEvaluator.clearErrors();
  return { values: cleanValues, errors };
}
