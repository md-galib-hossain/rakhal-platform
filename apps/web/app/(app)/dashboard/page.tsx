import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PageCard } from "@/components/shared/page-card";
import { TodayDatePill } from "@/features/dashboard/components/overview-header";
import { PrioritiesPanel } from "@/features/dashboard/components/priorities-panel";
import { KpiBar } from "@/features/dashboard/components/kpi-bar";
import { ProductionSummaryCard } from "@/features/dashboard/components/production-summary-card";
import { CalvingForecastCard } from "@/features/dashboard/components/calving-forecast-card";
import { HerdStatusDonut } from "@/features/dashboard/components/herd-status-donut";
import { LivestockStateChart } from "@/features/dashboard/components/livestock-state-chart";
import { FinancialSnapshotCard } from "@/features/dashboard/components/financial-snapshot-card";
import { FeedStockAlertsCard } from "@/features/dashboard/components/feed-stock-alerts-card";
import { UpcomingTasksCard } from "@/features/dashboard/components/upcoming-tasks-card";
import { FinancialPerformanceChart } from "@/features/dashboard/components/financial-performance-chart";
import { ProductionVsFeedcostChart } from "@/features/dashboard/components/production-vs-feedcost-chart";
import { ConceptionRateChart } from "@/features/dashboard/components/conception-rate-chart";
import { ActivityLogCard } from "@/features/dashboard/components/activity-log-card";
import { MilkTrendCard } from "@/features/dashboard/components/milk-trend-card";
import { FeedCostCard } from "@/features/dashboard/components/feed-cost-card";
import { ReportExportButton } from "@/features/reports/components/report-export-button";
import { DASHBOARD_EXPORT_REPORT } from "@/features/reports/report-defs";
import type { Locale } from "@/lib/constants/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("dashboard")} — Rakhal`, robots: { index: false } };
}

/**
 * Dashboard / "Morning Briefing" (RFE-020, PRD §7, API §3) — 9 widgets, each backed by its own
 * `GET /dashboard/*` query (`features/dashboard/hooks/use-dashboard-widgets.ts`, `staleTime` 60s).
 * Layout is pixel-matched against the Figma "Dashboard" frame's 3-per-row card rhythm (file
 * SCfMPdxP6vgW1uTxfqCtz7, node 732:1656), each widget in the same `DashboardCard` chrome as the
 * Figma mock. The Figma mock's "Financial Performance Over Time" (12-month trend), "Production vs
 * Feedcost" (daily trend), and "Conception Rate" (reproduction trend) widgets originally had no
 * backing endpoint in this backend's 9 real `GET /dashboard/*` routes; three new routes
 * (`financial-performance`, `production-vs-feedcost`, `conception-rate` —
 * `dashboard.service.ts`) now aggregate real `FinanceTransaction`/`MilkLogEntry`/
 * `FeedDistribution`/`BreedingEvent` rows into the 12-month/daily series those charts need, seeded
 * with a year of demo history (`prisma/seed.ts#seedDemoDashboardHistory`) so they render a real
 * curve. Each widget owns its own loading/error/empty/success state rather than a shared React
 * ErrorBoundary — a failed widget's query never affects its siblings, the same fault isolation the
 * ticket's AC asks for (see the hooks file's header comment for the full reasoning).
 *
 * **Refinement pass (2026-07-11)**, re-inspected live via the Figma plugin (not just the earlier
 * cached node comments) and found two things the first pass missed: (1) a page-header layer (node
 * 732:1715, parent 732:1656 "Dashboard") this app never built — a bold "Overview" title + a static
 * today's-date pill, replacing the generic `PageHeader` on this page only (which has no
 * breadcrumbs/action-button slot to offer here); (2) the 3-per-row grid's row ratios
 * were wrong — Figma's row 2 is Financial Performance at **2 of 3 columns** (752/1138px) next to a
 * 1-column companion (752+370+16 gap = 1138, not one card at full width), and row 3 is Production
 * vs Feedcost at 2 columns next to Conception Rate at 1 (680+442+16). Fixed by giving
 * `FinancialPerformanceChart`/`ProductionVsFeedcostChart` `lg:col-span-2` and placing them
 * immediately before `PrioritiesPanel`/`ConceptionRateChart` respectively so the grid's auto-flow
 * fills each row exactly — reused `PrioritiesPanel` for the 1-column slot Figma's mock fills with
 * an "Activity & Actions" panel this backend has no equivalent list for, rather than build a new
 * widget for one slot. Chart colors/legend pills also corrected to Figma's exact hex (previously
 * approximated from the CSS `--chart-*` token ramp): Income `#007FFF`/Expense `#F43F5E` (dashed)/
 * Profit `#10B981` (solid, gradient area fill — the only filled series, node 732:1864), Production
 * `#059669`/Feedcost `#FFBF54` (node 732:2017), Monthly Conception `#059669`/Avg. Rate `#FFBF54`
 * with its own gradient fill (node 732:2250) — legend dots changed from circles to the app's usual
 * `h-1.5 w-3 rounded-full` pill (matches `HerdStatusDonut`'s legend, not a new shape).
 *
 * **Parent-card wrapper (2026-07-11 follow-up, user request):** all widgets now sit inside one
 * `PageCard` (`components/shared/page-card.tsx`) instead of floating independently on the bare
 * page background — the title+date-pill header row moved into `PageCard`'s `actions` slot. Not a
 * Figma-sourced pattern (node 732:1714, the equivalent Figma container, has no fill/shadow of its
 * own — confirmed via the Figma plugin) but reuses `DashboardCard`'s established card chrome
 * (`rounded-2xl bg-card` + the same drop shadow) so it doesn't invent a new visual language. Same
 * pattern applied to `/cattle`; intended for every module page going forward.
 */
export default async function DashboardPage() {
  const t = await getTranslations("dashboard.overview");
  const locale = (await getLocale()) as Locale;

  return (
    <PageCard
      title={t("title")}
      actions={
        <div className="flex items-center gap-2">
          <ReportExportButton report={DASHBOARD_EXPORT_REPORT} variant="secondary" />
          <TodayDatePill locale={locale} />
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <KpiBar />
        <HerdStatusDonut />
        <LivestockStateChart />
        {/* Figma row: Financial Performance (2 cols) + Priorities (1 col) fill one row exactly */}
        <FinancialPerformanceChart />
        <PrioritiesPanel />
        {/* Production vs Feedcost (2 cols) + Production Trend/MilkTrend (1 col) fill one row;
         * Conception Rate moved to next line where the grid's 3-col auto-flow fills it exactly
         * alongside Production Summary + Financial Snapshot (user request, 2026-09-10). */}
        <ProductionVsFeedcostChart />
        <MilkTrendCard />
        <ConceptionRateChart />
        <ProductionSummaryCard />
        <FinancialSnapshotCard />
        <CalvingForecastCard />
        <FeedStockAlertsCard />
        <UpcomingTasksCard />
        <ActivityLogCard />
        <FeedCostCard />
      </div>
    </PageCard>
  );
}
