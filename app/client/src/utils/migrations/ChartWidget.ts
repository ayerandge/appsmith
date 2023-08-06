import type { WidgetProps } from "widgets/BaseWidget";
import type { DSLWidget } from "widgets/constants";
import type { ChartWidgetProps } from "widgets/ChartWidget/widget";
import { LabelOrientation } from "widgets/ChartWidget/constants";
import { traverseDSLAndMigrate } from "utils/WidgetMigrationUtils";
import { DefaultEChartConfig } from "widgets/ChartWidget/constants";

export const migrateChartWidgetLabelOrientationStaggerOption = (
  currentDSL: DSLWidget,
) => {
  return traverseDSLAndMigrate(currentDSL, (widget: WidgetProps) => {
    if (widget.type == "CHART_WIDGET") {
      const chartWidgetProps = widget as ChartWidgetProps;
      if (chartWidgetProps.labelOrientation == LabelOrientation.STAGGER) {
        chartWidgetProps.labelOrientation = LabelOrientation.AUTO;
      }
    }
  });
};

export const migrateDefaultValuesForCustomEChart = (currentDSL: DSLWidget) => {
  return traverseDSLAndMigrate(currentDSL, (widget: WidgetProps) => {
    if (widget.type == "CHART_WIDGET") {
      const chartWidgetProps = widget as ChartWidgetProps;
      chartWidgetProps.customEChartConfig = DefaultEChartConfig;
    }
  });
};
