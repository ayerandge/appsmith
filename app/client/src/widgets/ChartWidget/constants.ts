import { Colors } from "constants/Colors";

export type ChartType =
  | "LINE_CHART"
  | "BAR_CHART"
  | "PIE_CHART"
  | "COLUMN_CHART"
  | "AREA_CHART"
  | "CUSTOM_ECHART"
  | "CUSTOM_FUSION_CHART";

export const XAxisCategory = "Category";
export interface ChartDataPoint {
  x: any;
  y: any;
}

export interface ChartData {
  seriesName?: string;
  data: ChartDataPoint[];
  color?: string;
}

export interface CustomFusionChartConfig {
  type: string;
  dataSource?: any;
}

export interface AllChartData {
  [key: string]: ChartData;
}

export interface ChartSelectedDataPoint {
  x: any;
  y: any;
  seriesTitle: string;
}

export const messages = {
  ErrorTitle: "Error in Chart Data/Configuration",
  MoreDetails: "More Details",
  EmptyData: "No chart data to display",
  Undefined: "Undefined",
};

export const CUSTOM_CHART_TYPES = [
  "area2d",
  "bar2d",
  "bar3d",
  "boxandwhisker2d",
  "candlestick",
  "chord",
  "dragnode",
  "dragarea",
  "dragcolumn2d",
  "dragline",
  "errorbar2d",
  "errorline",
  "errorscatter",
  "funnel",
  "gantt",
  "heatmap",
  "hbullet",
  "hled",
  "InverseMSArea",
  "InverseMSColumn2D",
  "InverseMSLine",
  "LogMSColumn2D",
  "LogMSLine",
  "MultiAxisLine",
  "multilevelpie",
  "overlappedcolumn2d",
  "overlappedbar2d",
  "pyramid",
  "radar",
  "angulargauge",
  "realtimearea",
  "bulb",
  "realtimecolumn",
  "cylinder",
  "hlineargauge",
  "realtimeline",
  "realtimelinedy",
  "realtimestackedarea",
  "realtimestackedcolumn",
  "thermometer",
  "sankey",
  "selectscatter",
  "sparkcolumn",
  "sparkline",
  "sparkwinloss",
  "msstepline",
  "sunburst",
  "treemap",
  "vbullet",
  "vled",
  "waterfall2d",
  "zoomline",
  "zoomlinedy",
  "zoomscatter",
  "column2d",
  "column3d",
  "line",
  "area",
  "bar2d",
  "bar3d",
  "pie2d",
  "pie3d",
  "doughnut2d",
  "doughnut3d",
  "pareto2d",
  "pareto3d",
  "scrollcombidy2d",
  "scrollcombi2d",
  "scrollstackedcolumn2d",
  "scrollmsstackedcolumn2d",
  "scrollmsstackedcolumn2dlinedy",
  "scrollstackedbar2d",
  "scrollarea2d",
  "scrollline2d",
  "scrollcolumn2d",
  "scrollbar2d",
  "bubble",
  "scatter",
  "msstackedcolumn2d",
  "stackedarea2d",
  "stackedbar3d",
  "stackedbar2d",
  "stackedcolumn3d",
  "stackedcolumn2d",
  "msstackedcolumn2dlinedy",
  "stackedcolumn3dlinedy",
  "mscolumn3dlinedy",
  "mscombidy2d",
  "mscombidy3d",
  "stackedcolumn3dline",
  "stackedcolumn2dline",
  "mscolumnline3d",
  "mscombi3d",
  "mscombi2d",
  "marimekko",
  "MSArea",
  "msbar3d",
  "msbar2d",
  "msline",
  "mscolumn3d",
  "mscolumn2d",
  "spline",
  "splinearea",
  "msspline",
  "mssplinedy",
  "mssplinearea",
  "stackedcolumn2dlinedy",
  "stackedarea2dlinedy",
];

export enum LabelOrientation {
  AUTO = "auto",
  SLANT = "slant",
  ROTATE = "rotate",
  STAGGER = "stagger",
}

export const LABEL_ORIENTATION_COMPATIBLE_CHARTS = [
  "LINE_CHART",
  "AREA_CHART",
  "COLUMN_CHART",
];

export const DefaultCustomEChartDataset = {};

export const DefaultCustomEChartConfig = {
  tooltip: {
    trigger: "axis",
    axisPointer: {
      type: "shadow",
    },
  },
  legend: {},
  grid: {
    left: "3%",
    right: "4%",
    bottom: "3%",
    containLabel: true,
  },
  xAxis: [
    {
      type: "category",
      data: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    },
  ],
  yAxis: [
    {
      type: "value",
    },
  ],
  series: [
    {
      name: "Direct",
      type: "bar",
      emphasis: {
        focus: "series",
      },
      data: [320, 332, 301, 334, 390, 330, 320],
    },
    {
      name: "Email",
      type: "bar",
      stack: "Ad",
      emphasis: {
        focus: "series",
      },
      data: [120, 132, 101, 134, 90, 230, 210],
    },
    {
      name: "Union Ads",
      type: "bar",
      stack: "Ad",
      emphasis: {
        focus: "series",
      },
      data: [220, 182, 191, 234, 290, 330, 310],
    },
    {
      name: "Video Ads",
      type: "bar",
      stack: "Ad",
      emphasis: {
        focus: "series",
      },
      data: [150, 232, 201, 154, 190, 330, 410],
    },
    {
      name: "Search Engine",
      type: "bar",
      data: [862, 1018, 964, 1026, 1679, 1600, 1570],
      emphasis: {
        focus: "series",
      },
      markLine: {
        lineStyle: {
          type: "dashed",
        },
        data: [[{ type: "min" }, { type: "max" }]],
      },
    },
    {
      name: "Baidu",
      type: "bar",
      barWidth: 5,
      stack: "Search Engine",
      emphasis: {
        focus: "series",
      },
      data: [620, 732, 701, 734, 1090, 1130, 1120],
    },
    {
      name: "Google",
      type: "bar",
      stack: "Search Engine",
      emphasis: {
        focus: "series",
      },
      data: [120, 132, 101, 134, 290, 230, 220],
    },
    {
      name: "Bing",
      type: "bar",
      stack: "Search Engine",
      emphasis: {
        focus: "series",
      },
      data: [60, 72, 71, 74, 190, 130, 110],
    },
    {
      name: "Others",
      type: "bar",
      stack: "Search Engine",
      emphasis: {
        focus: "series",
      },
      data: [62, 82, 91, 84, 109, 110, 120],
    },
  ],
};

export const DefaultEChartDatasource = {
  source: [
    ["product", "2012", "2013", "2014", "2015", "2016", "2017"],
    ["Milk Tea", 56.5, 82.1, 88.7, 70.1, 53.4, 85.1],
    ["Matcha Latte", 51.1, 51.4, 55.1, 53.3, 73.8, 68.7],
    ["Cheese Cocoa", 40.1, 62.2, 69.5, 36.4, 45.2, 32.5],
    ["Walnut Brownie", 25.2, 37.1, 41.2, 18, 33.9, 49.1],
  ],
};

export const DefaultEChartConfig = {
  legend: {},
  tooltip: {
    trigger: "axis",
    showContent: false,
  },
  xAxis: { type: "category" },
  yAxis: { gridIndex: 0 },
  grid: { top: "55%" },
  series: [
    {
      type: "line",
      smooth: true,
      seriesLayoutBy: "row",
      emphasis: { focus: "series" },
    },
    {
      type: "line",
      smooth: true,
      seriesLayoutBy: "row",
      emphasis: { focus: "series" },
    },
    {
      type: "line",
      smooth: true,
      seriesLayoutBy: "row",
      emphasis: { focus: "series" },
    },
    {
      type: "line",
      smooth: true,
      seriesLayoutBy: "row",
      emphasis: { focus: "series" },
    },
    {
      type: "pie",
      id: "pie",
      radius: "30%",
      center: ["50%", "25%"],
      emphasis: {
        focus: "self",
      },
      label: {
        formatter: "{b}: {@2012} ({d}%)",
      },
      encode: {
        itemName: "product",
        value: "2012",
        tooltip: "2012",
      },
    },
  ],
};

export const DefaultEChartsBasicChartsData = {
  seriesName: "2023",
  data: [
    {
      x: "Product1",
      y: 20000,
    },
    {
      x: "Product2",
      y: 22000,
    },
    {
      x: "Product3",
      y: 32000,
    },
  ],
};

export const DefaultFusionChartConfig = {
  type: "column2d",
  dataSource: {
    data: [
      {
        label: "Product1",
        value: 20000,
      },
      {
        label: "Product2",
        value: 22000,
      },
      {
        label: "Product3",
        value: 32000,
      },
    ],
    chart: {
      caption: "Sales Report",
      xAxisName: "Product Line",
      yAxisName: "Revenue($)",
      theme: "fusion",
      alignCaptionWithCanvas: 1,
      // Caption styling =======================
      captionFontSize: "24",
      captionAlignment: "center",
      captionPadding: "20",
      captionFontColor: Colors.THUNDER,
      // legend position styling ==========
      legendIconSides: "4",
      legendIconBgAlpha: "100",
      legendIconAlpha: "100",
      legendPosition: "top",
      // Canvas styles ========
      canvasPadding: "0",
      // Chart styling =======
      chartLeftMargin: "20",
      chartTopMargin: "10",
      chartRightMargin: "40",
      chartBottomMargin: "10",
      // Axis name styling ======
      xAxisNameFontSize: "14",
      labelFontSize: "12",
      labelFontColor: Colors.DOVE_GRAY2,
      xAxisNameFontColor: Colors.DOVE_GRAY2,

      yAxisNameFontSize: "14",
      yAxisValueFontSize: "12",
      yAxisValueFontColor: Colors.DOVE_GRAY2,
      yAxisNameFontColor: Colors.DOVE_GRAY2,
    },
  },
};
