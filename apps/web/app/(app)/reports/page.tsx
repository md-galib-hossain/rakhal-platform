import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@/components/shared/page-card";
import { ReportsWorkspace } from "@/features/reports/components/reports-workspace";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("reports")} — Rakhal`, robots: { index: false } };
}

/**
 * RFE-041 — Reports (PRD §22, API §15). Report catalogue (12 MVP reports grouped by category) with
 * a generate dialog (per-report params) that polls the async `ReportJob` (RD-013a, BullMQ-backed)
 * to completion, then a real download link; plus a scheduled-reports panel (RD-013c). Both gated
 * behind the `reports.generate` subscription feature — `ReportsWorkspace` renders the locked state.
 * Replaces the placeholder `RouteStub` this route previously rendered.
 */
export default async function ReportsPage() {
  const t = await getTranslations("nav");
  return (
    <PageCard title={t("reports")}>
      <ReportsWorkspace />
    </PageCard>
  );
}
