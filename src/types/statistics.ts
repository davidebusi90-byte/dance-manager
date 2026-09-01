export type ChartType = "pie" | "bar" | "line";
export type ChartMetric = "couples" | "entries" | "anomalies" | "athletes";
export type ChartGroupBy = "season" | "class" | "category" | "instructor" | "competition";

export interface CustomChart {
  id: string;
  title: string;
  type: ChartType;
  metric: ChartMetric;
  groupBy: ChartGroupBy;
}

export interface CustomTab {
  id: string;
  name: string;
  charts: CustomChart[];
}

export interface StatisticsPreferences {
  tabs: CustomTab[];
}
