"use client"; // layout state + dnd-kit section sorter + persistent ordering

import { useState } from "react";
import { Sliders } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LAYOUT_TOOLBAR_STICKY,
  LayoutEditControls,
  SectionSorter,
} from "@/components/shared/section-sorter";
import { useSectionLayout } from "@/lib/hooks/use-section-layout";
import { PrioritiesPanel } from "./priorities-panel";
import { KpiBar } from "./kpi-bar";
import { ProductionSummaryCard } from "./production-summary-card";
import { CalvingForecastCard } from "./calving-forecast-card";
import { HerdStatusDonut } from "./herd-status-donut";
import { LivestockStateChart } from "./livestock-state-chart";
import { FinancialSnapshotCard } from "./financial-snapshot-card";
import { FeedStockAlertsCard } from "./feed-stock-alerts-card";
import { UpcomingTasksCard } from "./upcoming-tasks-card";
import { FinancialPerformanceChart } from "./financial-performance-chart";
import { ProductionVsFeedcostChart } from "./production-vs-feedcost-chart";
import { ConceptionRateChart } from "./conception-rate-chart";
import { ActivityLogCard } from "./activity-log-card";
import { MilkTrendCard } from "./milk-trend-card";
import { FeedCostCard } from "./feed-cost-card";

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

const STORAGE_KEY = "rakhal_dashboard_layout_blocks_v2";

const DEFAULT_BLOCK_IDS = DEFAULT_DASHBOARD_BLOCKS.map((b) => b.id);

export function DashboardWorkspace() {
  // Draft order while customizing; null = viewing. Saved only by "Save layout".
  const [draft, setDraft] = useState<string[] | null>(null);
  const isCustomizing = draft !== null;
  const { order: blocks, save, reset } = useSectionLayout(STORAGE_KEY, DEFAULT_BLOCK_IDS);

  const getBlockMeta = (id: DashboardBlockId) => {
    return DEFAULT_DASHBOARD_BLOCKS.find((b) => b.id === id);
  };

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
      {/* One toolbar row in both modes (same height), so entering customize never shifts the page. */}
      <div
        className={cn(
          "flex min-h-12 items-center justify-end gap-3 rounded-2xl px-1",
          isCustomizing && cn(LAYOUT_TOOLBAR_STICKY, "border border-border bg-card/90 px-3 shadow-sm backdrop-blur-md"),
        )}
      >
        {isCustomizing ? (
          <>
            <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              Drag a section by its handle to reorder.
            </p>
            <LayoutEditControls
              onReset={() => {
                reset();
                setDraft(null);
              }}
              onCancel={() => setDraft(null)}
              onSave={() => {
                save(draft);
                setDraft(null);
              }}
            />
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDraft([...blocks])}
            className="h-9 gap-1.5 border-border bg-card px-3 font-medium text-foreground hover:bg-muted"
          >
            <Sliders className="size-4 text-muted-foreground" aria-hidden />
            <span>Customize Layout</span>
          </Button>
        )}
      </div>

      {isCustomizing ? (
        <SectionSorter
          sections={DEFAULT_DASHBOARD_BLOCKS}
          order={draft}
          onChange={setDraft}
          renderSection={(id) => renderBlockContent(id as DashboardBlockId)}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {blocks.map((id) => (
            <section key={id} aria-label={getBlockMeta(id)?.label ?? id} className="min-w-0">
              {renderBlockContent(id)}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
