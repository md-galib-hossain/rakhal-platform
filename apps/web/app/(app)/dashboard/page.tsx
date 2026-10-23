import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@/components/shared/page-card";
import { DashboardWorkspace } from "@/features/dashboard/components/dashboard-workspace";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("dashboard")} — Rakhal`, robots: { index: false } };
}

/**
 * Dashboard / "Morning Briefing" Page.
 * Clean, distraction-free header without export button or misplaced date pickers.
 */
export default async function DashboardPage() {
  const t = await getTranslations("dashboard.overview");

  return (
    <PageCard title={t("title")}>
      <DashboardWorkspace />
    </PageCard>
  );
}
