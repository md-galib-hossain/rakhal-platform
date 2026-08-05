import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@/components/shared/page-card";
import { HealthcareView } from "@/features/health/components/healthcare-view";
import { ReportExportButton } from "@/features/reports/components/report-export-button";
import { HEALTHCARE_EXPORT_REPORT } from "@/features/reports/report-defs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("healthcare")} — Rakhal`, robots: { index: false } };
}

/**
 * Healthcare (PRD §13, Figma node 734:35601): Key Metrics + Morbidity Trend widgets, the Health
 * Management Center's Sick Bay/Task Hub/Health Plan tabs, and the Case Management sheet (Log
 * Treatment / Health Update / Close Case incl. Log Mortality — Figma
 * 734:37459/38378/39319/40144). All real backend routes, verified against
 * `health.controller.ts`/`cattle-health.controller.ts`/`health.service.ts`.
 */
export default async function HealthcarePage() {
  const t = await getTranslations("nav");

  return (
    <PageCard title={t("healthcare")} actions={<ReportExportButton report={HEALTHCARE_EXPORT_REPORT} />}>
      <HealthcareView />
    </PageCard>
  );
}
