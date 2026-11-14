"use client";

import dynamic from "next/dynamic";
import { CardSkeleton } from "@rakhal/ui/shared/card-skeleton";
import { PrioritiesPanel } from "./priorities-panel";
import { KpiBar } from "./kpi-bar";
import { ProductionSummaryCard } from "./production-summary-card";
import { HerdStatusDonut } from "./herd-status-donut";
import { LivestockStateChart } from "./livestock-state-chart";
import { FinancialSnapshotCard } from "./financial-snapshot-card";
import { MilkTrendCard } from "./milk-trend-card";

const FinancialPerformanceChart = dynamic(
  () => import("./financial-performance-chart").then((m) => m.FinancialPerformanceChart),
  { loading: () => <CardSkeleton className="min-h-[360px] rounded-2xl" /> },
);
const ProductionVsFeedcostChart = dynamic(
  () => import("./production-vs-feedcost-chart").then((m) => m.ProductionVsFeedcostChart),
  { loading: () => <CardSkeleton className="min-h-[360px] rounded-2xl" /> },
);
const ConceptionRateChart = dynamic(
  () => import("./conception-rate-chart").then((m) => m.ConceptionRateChart),
  { loading: () => <CardSkeleton className="min-h-[360px] rounded-2xl" /> },
);
const CalvingForecastCard = dynamic(
  () => import("./calving-forecast-card").then((m) => m.CalvingForecastCard),
  { loading: () => <CardSkeleton className="min-h-[360px] rounded-2xl" /> },
);
const FeedStockAlertsCard = dynamic(
  () => import("./feed-stock-alerts-card").then((m) => m.FeedStockAlertsCard),
  { loading: () => <CardSkeleton className="min-h-[360px] rounded-2xl" /> },
);
const UpcomingTasksCard = dynamic(
  () => import("./upcoming-tasks-card").then((m) => m.UpcomingTasksCard),
  { loading: () => <CardSkeleton className="min-h-[360px] rounded-2xl" /> },
);
const ActivityLogCard = dynamic(
  () => import("./activity-log-card").then((m) => m.ActivityLogCard),
  { loading: () => <CardSkeleton className="min-h-[360px] rounded-2xl" /> },
);
const FeedCostCard = dynamic(
  () => import("./feed-cost-card").then((m) => m.FeedCostCard),
  { loading: () => <CardSkeleton className="min-h-[360px] rounded-2xl" /> },
);

export type DashboardBlockId =
  | "top-kpi-row"
  | "financial-row"
  | "production-row"
  | "performance-row"
  | "operations-row"
  | "activity-row";

export interface DashboardBlockMeta {
  id: DashboardBlockId;
  label: string;
}

export const DEFAULT_DASHBOARD_BLOCKS: DashboardBlockMeta[] = [
  { id: "top-kpi-row", label: "Metrics & Herd Status" },
  { id: "financial-row", label: "Financial Performance & Today's Priorities" },
  { id: "production-row", label: "Production vs Feedcost & Milk Trend" },
  { id: "performance-row", label: "Conception, Yield & Financial Snapshot" },
  { id: "operations-row", label: "Calving, Feed Alerts & Upcoming Tasks" },
  { id: "activity-row", label: "Activity Log & Feed Cost" },
];

export function DashboardWorkspace() {
  const renderBlockContent = (id: DashboardBlockId) => {
    switch (id) {
      case "top-kpi-row":
        return (
          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
            <div className="flex h-full min-w-0 flex-col">
              <KpiBar />
            </div>
            <div className="flex h-full min-w-0 flex-col">
              <HerdStatusDonut />
            </div>
            <div className="flex h-full min-w-0 flex-col">
              <LivestockStateChart />
            </div>
          </div>
        );

      case "financial-row":
        return (
          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
            <div className="flex h-full min-w-0 flex-col lg:col-span-2">
              <FinancialPerformanceChart />
            </div>
            <div className="flex h-full min-w-0 flex-col lg:col-span-1">
              <PrioritiesPanel />
            </div>
          </div>
        );

      case "production-row":
        return (
          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
            <div className="flex h-full min-w-0 flex-col lg:col-span-2">
              <ProductionVsFeedcostChart />
            </div>
            <div className="flex h-full min-w-0 flex-col lg:col-span-1">
              <MilkTrendCard />
            </div>
          </div>
        );

      case "performance-row":
        return (
          <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex h-full min-w-0 flex-col">
              <ConceptionRateChart />
            </div>
            <div className="flex h-full min-w-0 flex-col">
              <ProductionSummaryCard />
            </div>
            <div className="flex h-full min-w-0 flex-col sm:col-span-2 lg:col-span-1">
              <FinancialSnapshotCard />
            </div>
          </div>
        );

      case "operations-row":
        return (
          <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex h-full min-w-0 flex-col">
              <CalvingForecastCard />
            </div>
            <div className="flex h-full min-w-0 flex-col">
              <FeedStockAlertsCard />
            </div>
            <div className="flex h-full min-w-0 flex-col sm:col-span-2 lg:col-span-1">
              <UpcomingTasksCard />
            </div>
          </div>
        );

      case "activity-row":
        return (
          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
            <div className="flex h-full min-w-0 flex-col lg:col-span-2">
              <ActivityLogCard />
            </div>
            <div className="flex h-full min-w-0 flex-col lg:col-span-1">
              <FeedCostCard />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {DEFAULT_DASHBOARD_BLOCKS.map((block) => (
        <section key={block.id} aria-label={block.label} className="min-w-0">
          {renderBlockContent(block.id)}
        </section>
      ))}
    </div>
  );
}
