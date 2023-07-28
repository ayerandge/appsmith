import type { ChartComponentProps } from ".";
import { LabelOrientation, type ChartData } from "../constants";

import { Colors } from "constants/Colors";

export class EChartsConfigurationBuilder {
  fontFamily: string | undefined;

  #seriesConfigForChartType(
    props: ChartComponentProps,
    chartData: ChartData[],
  ) {
    /**
     * {
     *  series: [ { type: "pie", radius: "40%", center: ["50%", 50%]}]
     * }
     */
    return chartData.map((chartDatum, index) => {
      let config: Record<string, unknown> = {
        label: { show: true, position: "top" },
      };
      let color = chartDatum.color;

      if (index == 0 && !color) {
        color = props.primaryColor;
      }

      switch (props.chartType) {
        case "BAR_CHART":
        case "COLUMN_CHART":
          config = { ...config, type: "bar", itemStyle: { color: color } };
          break;
        case "LINE_CHART":
          config = { ...config, type: "line", itemStyle: { color: color } };
          break;
        case "AREA_CHART":
          config = {
            ...config,
            type: "line",
            itemStyle: { color: color },
            areaStyle: {},
          };
          break;
        case "PIE_CHART":
          config = {
            type: "pie",
            radius: "40%",
            center: ["50%", "55%"],
            label: {
              show: true,
              fontFamily: this.fontFamily,
              color: Colors.DOVE_GRAY2,
            },
          };
          break;
      }

      return config;
    });
  }

  #evaluateFontFamily(fontFamily: string | undefined) {
    return fontFamily === "System Default" ? "inherit" : fontFamily;
  }

  #titleConfigForChart(props: ChartComponentProps, chartData: ChartData[]) {
    /**
     * title: [
     * {
     *  text: "chart title",
     * },
     * // Valid for PIE Chart only
     * {
     *
     *   text: "2014",
     *   top: "15%",
     *   left: "50%",
     *   textAlign: "center"
     *   }
     * ]
     */
    const defaultTitleConfig = {
      text: props.chartName,
      padding: [5, 50],
      left: "center",
      textStyle: {
        fontFamily: this.fontFamily,
        fontSize: 24,
        color: Colors.THUNDER,
        overflow: "truncate",
        width: props.dimensions.componentWidth - 100,
      },
    };
    if (props.chartType == "PIE_CHART") {
      const config: Record<string, unknown>[] = [defaultTitleConfig];
      const numSeries = chartData.length;
      const interval = 100 / (numSeries + 1);

      chartData.forEach((seriesData, index) => {
        const offset = `${(index + 1) * interval}%`;
        config.push({
          top: "25%",
          left: offset,
          textAlign: "center",
          text: seriesData.seriesName ?? "",
        });
      });
      return config;
    } else {
      return defaultTitleConfig;
    }
  }

  #configForLabelOrientation(props: ChartComponentProps) {
    const config: Record<string, unknown> = {
      fontFamily: this.fontFamily,
      color: Colors.DOVE_GRAY2,
    };
    if (props.labelOrientation == "slant") {
      config.rotate = "45";
    } else if (props.labelOrientation == "rotate") {
      config.rotate = "90";
    } else {
      config.rotate = "0";
    }
    return config;
  }

  #gridBottomOffset(props: ChartComponentProps) {
    let offset = 100;
    if (props.labelOrientation == LabelOrientation.ROTATE) {
      const offsetPercentage = 0.2 * props.dimensions.componentHeight;
      if (offsetPercentage > offset) {
        offset = offsetPercentage;
      }
    }

    return offset;
  }

  #defaultEChartConfig = (
    props: ChartComponentProps,
  ): Record<string, unknown> => {
    const config: Record<string, any> = {
      legend: {
        type: "scroll",
        left: "center",
        align: "left",
        top: "50",
        orient: "horizontal",
        textStyle: { fontFamily: this.fontFamily },
        padding: [5, 50],
      },
      tooltip: {
        trigger: "item",
      },
    };
    config.grid = {
      top: 100,
      bottom: this.#gridBottomOffset(props),
      left: "100",
    };
    return config;
  };

  #yAxisConfig = (props: ChartComponentProps) => {
    /**
     * {
     *  type: "value", name: "Y Axis Name", nameLocation: "end"
     * }
     */
    let config: Record<string, unknown> = {};
    if (props.chartType != "PIE_CHART") {
      config = {
        name: props.yAxisName,
        nameLocation: "middle",
        nameGap: 70,
        nameTextStyle: {
          fontSize: 14,
          fontFamily: this.fontFamily,
          color: Colors.DOVE_GRAY2,
        },
      };
    }
    if (props.chartType == "BAR_CHART") {
      config.type = "category";
    }
    if (props.setAdaptiveYMin) {
      config.min = "dataMin";
    }
    config.axisLabel = {
      fontFamily: this.fontFamily,
      color: Colors.DOVE_GRAY2,
    };
    return config;
  };

  #nameGapForXAxisLabel = (props: ChartComponentProps) => {
    let gap = 40;

    if (props.labelOrientation == LabelOrientation.ROTATE) {
      const percentageGap = 0.12 * props.dimensions.componentHeight;
      if (percentageGap > gap) {
        gap = percentageGap;
      }
    }

    return gap;
  };

  #xAxisConfig = (props: ChartComponentProps) => {
    /**
     * {
     *  type: "value", name: "X Axis Name", nameLocation: "end"
     * }
     */
    const config: Record<string, unknown> = {};
    let type = "category";
    if (props.chartType == "BAR_CHART") {
      type = "value";
    }
    config.type = type;
    config.axisLabel = this.#configForLabelOrientation(props);

    if (props.chartType == "BAR_CHART" && props.setAdaptiveYMin) {
      config.min = "dataMin";
    }

    if (props.chartType != "PIE_CHART") {
      config.name = props.xAxisName;
      config.nameLocation = "middle";
      config.nameGap = this.#nameGapForXAxisLabel(props);
      config.nameTextStyle = {
        fontSize: 14,
        fontFamily: this.fontFamily,
        color: Colors.DOVE_GRAY2,
      };
    } else {
      config.show = false;
    }
    return config;
  };

  #scrollConfig = (props: ChartComponentProps) => {
    if (props.allowScroll) {
      if (props.chartType != "PIE_CHART") {
        return [
          {
            type: "inside",
            filterMode: "filter",
            start: "20",
          },
        ];
      }
    }
    return [];
  };

  prepareEChartConfig(props: ChartComponentProps, chartData: ChartData[]) {
    this.fontFamily = this.#evaluateFontFamily(props.fontFamily);

    const chartConfig: Record<string, unknown> =
      this.#defaultEChartConfig(props);
    chartConfig.title = this.#titleConfigForChart(props, chartData);
    chartConfig.xAxis = this.#xAxisConfig(props);
    chartConfig.yAxis = this.#yAxisConfig(props);

    chartConfig.dataZoom = this.#scrollConfig(props);
    chartConfig.series = this.#seriesConfigForChartType(props, chartData);
    return chartConfig;
  }
}
