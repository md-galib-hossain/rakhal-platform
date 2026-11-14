import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@rakhal/ui/shared/page-card";
import { ReportsLanding } from "@/features/reports/components/landing/reports-landing";
import { NewReportButton } from "@/features/reports/components/landing/new-report-button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("reports")} — Rakhal`, robots: { index: false } };
}

/**
 * Server shell: title + subtitle render on the server; the permission-aware button and the data sections are the only
 * client leaves (they read the session / plan / URL filters and run queries).
 */
export default async function ReportsPage() {
  const t = await getTranslations("reportsLanding");
  return (
    <PageCard title={t("title")} actions={<NewReportButton />}>
      <p className="-mt-2 text-sm text-muted-foreground">{t("subtitle")}</p>
      <ReportsLanding />
    </PageCard>
  );
}
