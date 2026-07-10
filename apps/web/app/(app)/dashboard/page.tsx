import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { PrioritiesPanel } from "@/features/dashboard/components/priorities-panel";
import { KpiBar } from "@/features/dashboard/components/kpi-bar";
import { ProductionSummaryCard } from "@/features/dashboard/components/production-summary-card";
import { CalvingForecastCard } from "@/features/dashboard/components/calving-forecast-card";
import { HerdStatusDonut } from "@/features/dashboard/components/herd-status-donut";
import { LivestockStateChart } from "@/features/dashboard/components/livestock-state-chart";
import { FinancialSnapshotCard } from "@/features/dashboard/components/financial-snapshot-card";
import { FeedStockAlertsCard } from "@/features/dashboard/components/feed-stock-alerts-card";
import { UpcomingTasksCard } from "@/features/dashboard/components/upcoming-tasks-card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("dashboard")} — Rakhal`, robots: { index: false } };
}

/**
 * Dashboard / "Morning Briefing" (RFE-020, PRD §7, API §3) — 9 widgets, each backed by its own
 * `GET /dashboard/*` query (`features/dashboard/hooks/use-dashboard-widgets.ts`, `staleTime` 60s).
 * Each widget owns its own loading/error/empty/success state rather than a shared React
 * ErrorBoundary — a failed widget's query never affects its siblings, the same fault isolation the
 * ticket's AC asks for (see the hooks file's header comment for the full reasoning).
 */
export default async function DashboardPage() {
  const t = await getTranslations("nav");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("dashboard")} />
      <PrioritiesPanel />
      <KpiBar />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ProductionSummaryCard />
        <CalvingForecastCard />
        <FeedStockAlertsCard />
        <HerdStatusDonut />
        <LivestockStateChart />
        <FinancialSnapshotCard />
        <UpcomingTasksCard />
      </div>
    </div>
  );
}
