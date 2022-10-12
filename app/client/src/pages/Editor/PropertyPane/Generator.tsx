import { IPanelProps } from "@blueprintjs/core";
import {
  PropertyPaneConfig,
  PropertyPaneControlConfig,
  PropertyPaneSectionConfig,
} from "constants/PropertyControlConstants";
import { WidgetType } from "constants/WidgetConstants";
import React, { useEffect, useRef, useState } from "react";
import PropertyControl from "./PropertyControl";
import PropertySection from "./PropertySection";
import { EditorTheme } from "components/editorComponents/CodeEditor/EditorConfig";
import Boxed from "../GuidedTour/Boxed";
import { GUIDED_TOUR_STEPS } from "../GuidedTour/constants";
import { searchProperty } from "./helpers";
import { EmptySearchResult } from "./EmptySearchResult";
import { useSelector } from "react-redux";
import { getWidgetPropsForPropertyPane } from "selectors/propertyPaneSelectors";
import { isFunction } from "lodash";

export enum PropertyPaneGroup {
  CONTENT,
  STYLE,
}

export type PropertyControlsGeneratorProps = {
  id: string;
  config: readonly PropertyPaneConfig[];
  type: WidgetType;
  panel: IPanelProps;
  theme: EditorTheme;
  searchQuery?: string;
};

type SectionProps = {
  sectionConfig: PropertyPaneSectionConfig;
  config: PropertyPaneConfig;
  generatorProps: PropertyControlsGeneratorProps;
};

function Section(props: SectionProps) {
  const { config, generatorProps, sectionConfig } = props;
  const sectionRef = useRef<HTMLDivElement>(null);
  const widgetProps: any = useSelector(getWidgetPropsForPropertyPane);
  const [hidden, setHidden] = useState(false);

  const isSectionHidden =
    sectionConfig.hidden &&
    sectionConfig.hidden(widgetProps, sectionConfig.propertySectionPath || "");
  const sectionName = isFunction(sectionConfig.sectionName)
    ? sectionConfig.sectionName(
        widgetProps,
        sectionConfig.propertySectionPath || "",
      )
    : sectionConfig.sectionName;

  useEffect(() => {
    if (
      sectionRef.current === null ||
      sectionRef.current?.childElementCount === 0
    ) {
      // Fix issue where the section is not hidden when it has no children
      setHidden(true);
    } else {
      setHidden(false);
    }
  }, [generatorProps.searchQuery]);

  return hidden ? null : (
    <Boxed
      key={config.id + generatorProps.id}
      show={sectionName !== "General" && generatorProps.type === "TABLE_WIDGET"}
      step={GUIDED_TOUR_STEPS.TABLE_WIDGET_BINDING}
    >
      <PropertySection
        childrenWrapperRef={sectionRef}
        collapsible={sectionConfig.collapsible ?? true}
        hidden={isSectionHidden}
        id={config.id || sectionName}
        isDefaultOpen={sectionConfig.isDefaultOpen}
        key={config.id + generatorProps.id + generatorProps.searchQuery}
        name={sectionName}
        propertyPath={sectionConfig.propertySectionPath}
        tag={sectionConfig.tag}
      >
        {config.children &&
          generatePropertyControl(config.children, generatorProps)}
      </PropertySection>
    </Boxed>
  );
}

const generatePropertyControl = (
  propertyPaneConfig: readonly PropertyPaneConfig[],
  props: PropertyControlsGeneratorProps,
) => {
  if (!propertyPaneConfig) return null;
  return propertyPaneConfig.map((config: PropertyPaneConfig) => {
    if ((config as PropertyPaneSectionConfig).sectionName) {
      const sectionConfig: PropertyPaneSectionConfig = config as PropertyPaneSectionConfig;
      return (
        <Section
          config={config}
          generatorProps={props}
          key={config.id + props.id}
          sectionConfig={sectionConfig}
        />
      );
    } else if ((config as PropertyPaneControlConfig).controlType) {
      return (
        <Boxed
          key={config.id + props.id}
          show={
            (config as PropertyPaneControlConfig).propertyName !==
              "tableData" && props.type === "TABLE_WIDGET"
          }
          step={GUIDED_TOUR_STEPS.TABLE_WIDGET_BINDING}
        >
          <PropertyControl
            key={config.id + props.id}
            {...(config as PropertyPaneControlConfig)}
            panel={props.panel}
            theme={props.theme}
          />
        </Boxed>
      );
    }
    throw Error("Unknown configuration provided: " + props.type);
  });
};

function evaluateHiddenProperty(
  config: readonly PropertyPaneConfig[],
  widgetProps: any,
) {
  const finalConfig: PropertyPaneConfig[] = [];
  for (const conf of config) {
    const sectionConfig = conf as PropertyPaneSectionConfig;
    const controlConfig = conf as PropertyPaneControlConfig;
    if (sectionConfig.sectionName) {
      const isSectionHidden =
        sectionConfig.hidden &&
        sectionConfig.hidden(
          widgetProps,
          sectionConfig.propertySectionPath || "",
        );
      if (!isSectionHidden) {
        const children = evaluateHiddenProperty(
          sectionConfig.children,
          widgetProps,
        );
        if (children.length > 0) {
          finalConfig.push({
            ...sectionConfig,
            children,
          });
        }
      }
    } else if (controlConfig.controlType) {
      const isControlHidden =
        controlConfig.hidden &&
        controlConfig.hidden(widgetProps, controlConfig.propertyName);
      if (!isControlHidden) {
        finalConfig.push(conf);
      }
    }
  }
  return finalConfig;
}

function PropertyControlsGenerator(props: PropertyControlsGeneratorProps) {
  // console.log("bla", props.searchQuery, props.config, searchResults);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchResults = searchProperty(props.config, props.searchQuery);
  const [isSearchResultEmpty, setIsSearchResultEmpty] = useState(false);
  // const widgetProps: any = useSelector(getWidgetPropsForPropertyPane);

  // const finalProps = evaluateHiddenProperty(props.config, widgetProps);
  // const searchResults = searchProperty(finalProps, props.searchQuery);
  // const isSearchResultEmpty = searchResults.length === 0;

  // console.log("bla config", props.config, finalProps);
  // console.log("bla widgetProps", widgetProps);

  useEffect(() => {
    if (props.searchQuery) {
      if (searchResults.length === 0) {
        setIsSearchResultEmpty(true);
      } else {
        setIsSearchResultEmpty(false);
        // Fix issue where blank screen is shown when search results are empty due to hidden controls
        requestAnimationFrame(() => {
          if (
            wrapperRef.current === null ||
            wrapperRef.current?.childElementCount === 0
          ) {
            setIsSearchResultEmpty(true);
          } else {
            setIsSearchResultEmpty(false);
          }
        });
      }
    } else {
      setIsSearchResultEmpty(false);
    }
  }, [props.searchQuery]);

  return isSearchResultEmpty ? (
    <EmptySearchResult />
  ) : (
    <div ref={wrapperRef}>
      {generatePropertyControl(
        searchResults as readonly PropertyPaneConfig[],
        props,
      )}
    </div>
  );
}

export default PropertyControlsGenerator;
