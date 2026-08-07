import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@/components/shared/page-card";
import { ReproductionWorkspace } from "@/features/reproduction/components/reproduction-workspace";
import { ReportExportButton } from "@/features/reports/components/report-export-button";
import { LACTATION_HERD_DASHBOARD_REPORT } from "@/features/reports/report-defs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("reproduction")} — Rakhal`, robots: { index: false } };
}

/**
 * RFE-030 — Reproduction module (PRD §9, API §5, RAKHAL-051 dashboard/events, RAKHAL-214 protocols).
 * No Figma frames were given for this module — the layout follows the same widget-grid pattern
 * already shipped for Milk/Cattle: KPI row, action panels + 30-day calving forecast, open-cows
 * table, unified events feed, then the reproductive-protocols panel. All data from the real backend
 * (`reproduction.service.ts` / `repro-protocol.service.ts`), no mocks. Dry-off has no backend route
 * yet (`DryPeriod` is schema-only) — its dashboard panel is informational only, no create flow.
 * Replaces the placeholder `RouteStub` this route previously rendered.
 */
export default async function ReproductionPage() {
  const t = await getTranslations("nav");

  return (
    <PageCard
      title={t("reproduction")}
      actions={<ReportExportButton report={LACTATION_HERD_DASHBOARD_REPORT} variant="secondary" />}
    >
      <ReproductionWorkspace />
    </PageCard>
  );
}
