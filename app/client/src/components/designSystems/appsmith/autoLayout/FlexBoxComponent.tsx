import { isArray } from "lodash";
import React, { ReactNode } from "react";
import styled from "styled-components";

import { AppState } from "ce/reducers";
import {
  FlexLayerAlignment,
  LayoutDirection,
  Overflow,
} from "components/constants";
import { APP_MODE } from "entities/App";
import { useSelector } from "react-redux";
import { getAppMode } from "selectors/entitiesSelector";
import { getIsMobile } from "selectors/mainCanvasSelectors";
import AutoLayoutLayer from "./AutoLayoutLayer";
import { isCurrentCanvasDragging } from "selectors/autoLayoutSelectors";

export interface FlexBoxProps {
  direction?: LayoutDirection;
  stretchHeight: boolean;
  useAutoLayout: boolean;
  children?: ReactNode;
  widgetId: string;
  overflow: Overflow;
  flexLayers: FlexLayer[];
}

export interface LayerChild {
  id: string;
  align: FlexLayerAlignment;
}

export interface FlexLayer {
  children: LayerChild[];
  hasFillChild?: boolean;
}

export const FlexContainer = styled.div<{
  useAutoLayout?: boolean;
  direction?: LayoutDirection;
  stretchHeight: boolean;
  overflow: Overflow;
  leaveSpaceForWidgetName: boolean;
  isMobile?: boolean;
  isMainContainer: boolean;
}>`
  display: ${({ useAutoLayout }) => (useAutoLayout ? "flex" : "block")};
  flex-direction: ${({ direction }) =>
    direction === LayoutDirection.Vertical ? "column" : "row"};
  justify-content: flex-start;
  align-items: flex-start;
  flex-wrap: ${({ overflow }) =>
    overflow?.indexOf("wrap") > -1 ? overflow : "nowrap"};

  width: 100%;
  height: ${({ isMainContainer, stretchHeight }) =>
    isMainContainer || stretchHeight ? "100%" : "auto"};

  overflow: hidden;
  overflow-y: ${({ isMainContainer, isMobile }) =>
    isMainContainer || isMobile ? "auto" : "hidden"};

  padding: ${({ leaveSpaceForWidgetName }) =>
    leaveSpaceForWidgetName ? "4px 4px 22px 4px;" : "4px;"};
`;

export const DEFAULT_HIGHLIGHT_SIZE = 4;

export const DropPosition = styled.div<{
  isDragging: boolean;
  isVertical: boolean;
}>`
  width: ${({ isVertical }) =>
    isVertical ? `${DEFAULT_HIGHLIGHT_SIZE}px` : "calc(100% - 4px)"};
  height: ${({ isVertical }) =>
    isVertical ? "auto" : `${DEFAULT_HIGHLIGHT_SIZE}px`};
  background-color: rgba(223, 158, 206, 0.6);
  margin: 2px;
  display: ${({ isDragging }) => (isDragging ? "block" : "none")};
  align-self: stretch;
  opacity: 0;
`;

export const NewLayerStyled = styled.div<{
  isDragging: boolean;
}>`
  width: 100%;
`;

function FlexBoxComponent(props: FlexBoxProps) {
  // TODO: set isMobile as a prop at the top level
  const isMobile = useSelector(getIsMobile);
  const direction: LayoutDirection =
    props.direction || LayoutDirection.Horizontal;
  const appMode = useSelector(getAppMode);
  const leaveSpaceForWidgetName = appMode === APP_MODE.EDIT;
  // TODO: Add support for multiple dragged widgets
  const draggedWidget = useSelector(
    (state: AppState) =>
      state.ui.widgetDragResize?.dragDetails?.draggingGroupCenter?.widgetId,
  );

  const isDragging = useSelector(isCurrentCanvasDragging(props.widgetId));

  const renderChildren = () => {
    if (!props.children) return null;
    if (!props.useAutoLayout) return props.children;
    if (direction === LayoutDirection.Horizontal) {
      return addDropPositions(
        props.children as any,
        0,
        0,
        FlexLayerAlignment.Start,
        true,
        true,
      );
    }

    /**
     * Wrap children of a Vertical Stack in a flex layer.
     */
    const map: { [key: string]: any } = {};
    if (isArray(props.children)) {
      for (const child of props.children) {
        map[(child as JSX.Element).props?.widgetId] = child;
      }
    }

    const layers: any[] = cleanLayers(processLayers(map));

    return layers;
  };

  function cleanLayers(layers: any[]): any[] {
    if (!layers) return [];
    const set = new Set();
    return layers.filter((layer) => {
      const key = (layer as JSX.Element).key as string;
      const flag = set.has(key);
      set.add(key);
      return !flag;
    });
  }

  function DropPositionComponent(props: {
    isVertical: boolean;
    alignment: FlexLayerAlignment;
    layerIndex: number;
    childIndex: number;
    widgetId: string;
    isNewLayer: boolean;
  }) {
    return (
      <DropPosition
        className={`t--drop-position-${props.widgetId} alignment-${
          props.alignment
        } layer-index-${props.layerIndex} child-index-${props.childIndex} ${
          props.isVertical ? "isVertical" : "isHorizontal"
        } ${props.isNewLayer ? "isNewLayer" : ""}`}
        isDragging={isDragging}
        isVertical={props.isVertical}
      />
    );
  }

  function NewLayerComponent(props: {
    alignment: FlexLayerAlignment;
    childCount: number;
    layerIndex: number;
    isDragging: boolean;
    isNewLayer: boolean;
    isVertical: boolean;
    map: { [key: string]: any };
    widgetId: string;
  }): JSX.Element {
    const {
      alignment,
      childCount,
      isDragging,
      isNewLayer,
      isVertical,
      layerIndex,
      map,
      widgetId,
    } = props;

    const { element: verticalHighlights } = processIndividualLayer(
      { children: [], hasFillChild: false },
      childCount,
      layerIndex,
      map,
      true,
      true,
    );

    return (
      <NewLayerStyled
        className="selected"
        id={`new-layer-${widgetId}-${layerIndex}`}
        isDragging={isDragging}
      >
        <DropPositionComponent
          alignment={alignment}
          childIndex={childCount}
          isNewLayer={isNewLayer}
          isVertical={isVertical}
          key={getDropPositionKey(0, alignment, layerIndex, false)}
          layerIndex={layerIndex}
          widgetId={widgetId}
        />
        {verticalHighlights}
      </NewLayerStyled>
    );
  }

  const getDropPositionKey = (
    index: number,
    alignment: FlexLayerAlignment,
    layerIndex: number,
    isVertical: boolean,
  ): string =>
    `drop-layer-${props.widgetId}-${layerIndex}-${alignment}-${index}-${
      isVertical ? "vertical" : "horizontal"
    }-${Math.random()}`;

  const addDropPositions = (
    arr: any[],
    childCount: number,
    layerIndex: number,
    alignment: FlexLayerAlignment,
    isVertical: boolean,
    isNewLayer: boolean,
  ): any[] => {
    const res = [
      <DropPositionComponent
        alignment={alignment}
        childIndex={childCount}
        isNewLayer={isNewLayer}
        isVertical={isVertical}
        key={getDropPositionKey(0, alignment, layerIndex, true)}
        layerIndex={layerIndex}
        widgetId={props.widgetId}
      />,
    ];
    let count = 0;
    if (arr) {
      for (const item of arr) {
        const widgetId = item
          ? (item as JSX.Element)?.props.widgetId
          : undefined;
        if (draggedWidget && widgetId && draggedWidget === widgetId) continue;
        count += 1;
        res.push(item);
        res.push(
          <DropPositionComponent
            alignment={alignment}
            childIndex={childCount + count}
            isNewLayer={isNewLayer}
            isVertical={isVertical}
            key={getDropPositionKey(0, alignment, layerIndex, true)}
            layerIndex={layerIndex}
            widgetId={props.widgetId}
          />,
        );
      }
    }
    return res;
  };

  function processLayers(map: { [key: string]: any }) {
    const layers = [];
    let childCount = 0;
    let layerIndex = 0;
    for (const layer of props.flexLayers) {
      const isEmpty =
        layer?.children?.filter(
          (child: LayerChild) => child.id !== draggedWidget,
        ).length === 0;

      !isEmpty &&
        layers.push(
          <NewLayerComponent
            alignment={FlexLayerAlignment.Start}
            childCount={childCount}
            isDragging={isDragging}
            isNewLayer
            isVertical={false}
            key={getDropPositionKey(
              Math.ceil(Math.random() * 100),
              FlexLayerAlignment.Start,
              layerIndex,
              false,
            )}
            layerIndex={layerIndex}
            map={map}
            widgetId={props.widgetId}
          />,
        );

      const { count, element } = processIndividualLayer(
        layer,
        childCount,
        layerIndex,
        map,
      );
      childCount += count;
      if (!isEmpty) {
        layerIndex += 1;
        layers.push(element);
      }
    }
    layers.push(
      <NewLayerComponent
        alignment={FlexLayerAlignment.Start}
        childCount={childCount}
        isDragging={isDragging}
        isNewLayer
        isVertical={false}
        key={getDropPositionKey(
          Math.ceil(Math.random() * 100),
          FlexLayerAlignment.Start,
          layerIndex,
          false,
        )}
        layerIndex={layerIndex}
        map={map}
        widgetId={props.widgetId}
      />,
    );
    return layers;
  }

  function processIndividualLayer(
    layer: FlexLayer,
    childCount: number,
    index: number,
    map: { [key: string]: any },
    allowEmptyLayer = false,
    isNewLayer = false,
  ) {
    const { children, hasFillChild } = layer;

    let count = 0;
    let start = [],
      center = [],
      end = [];

    for (const child of children) {
      count += 1;
      const widget = map[child.id];
      if (hasFillChild) {
        start.push(widget);
        continue;
      }
      if (child.align === "end") end.push(widget);
      else if (child.align === "center") center.push(widget);
      else start.push(widget);
    }
    /**
     * Add drop positions
     */
    const startLength = start.length,
      centerLength = center.length;
    start = addDropPositions(
      start,
      childCount,
      index,
      FlexLayerAlignment.Start,
      true,
      isNewLayer,
    );
    center = addDropPositions(
      center,
      childCount + startLength,
      index,
      FlexLayerAlignment.Center,
      true,
      isNewLayer,
    );
    end = addDropPositions(
      end,
      childCount + startLength + centerLength,
      index,
      FlexLayerAlignment.End,
      true,
      isNewLayer,
    );

    return {
      element: (
        <AutoLayoutLayer
          center={center}
          currentChildCount={childCount}
          direction={direction}
          end={end}
          hasFillChild={layer.hasFillChild}
          hideOnLoad={allowEmptyLayer}
          index={index}
          isCurrentCanvasDragging={isDragging}
          isMobile={isMobile}
          key={index}
          start={start}
          widgetId={props.widgetId}
        />
      ),
      count,
    };
  }

  // function addInPosition(arr: any[], index: number, item: any): any[] {
  //   return [...arr.slice(0, index), item, ...arr.slice(index)];
  // }

  return (
    <FlexContainer
      className={`flex-container-${props.widgetId}`}
      direction={direction}
      isMainContainer={props.widgetId === "0"}
      isMobile={isMobile}
      leaveSpaceForWidgetName={leaveSpaceForWidgetName}
      overflow={props.overflow}
      stretchHeight={props.stretchHeight}
      useAutoLayout={props.useAutoLayout}
    >
      <>{renderChildren()}</>
    </FlexContainer>
  );
}

export default FlexBoxComponent;
