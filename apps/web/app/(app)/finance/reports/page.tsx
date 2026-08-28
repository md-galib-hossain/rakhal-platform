import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BarChart3 } from "lucide-react";
import { PageCard } from "@/components/shared/page-card";
import { EmptyState } from "@/components/shared/empty-state";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("finance.reportsPage");
  return { title: `${t("title")} — Rakhal`, robots: { index: false } };
}

/**
 * RAKHAL-381 — route scaffold only (MILESTONE 22, Phase D). Real content (P&L, Cash Flow,
 * Receivable/Payable Aging off RAKHAL-379) lands in RAKHAL-387, folded into the flattened
 * Finance tab bar by RAKHAL-382.
 */
export default async function FinanceReportsPage() {
  const t = await getTranslations();
  return (
    <PageCard title={t("finance.reportsPage.title")}>
      <EmptyState icon={BarChart3} title={t("common.comingSoonTitle")} description={t("common.comingSoonDescription")} />
    </PageCard>
  );
}
