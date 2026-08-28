import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Receipt } from "lucide-react";
import { PageCard } from "@/components/shared/page-card";
import { EmptyState } from "@/components/shared/empty-state";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("finance.transactionsPage");
  return { title: `${t("title")} — Rakhal`, robots: { index: false } };
}

/**
 * RAKHAL-381 — route scaffold only (MILESTONE 22, Phase D). Real content (the unified
 * `JournalTransaction`-header feed off `GET /finance/transactions`, RAKHAL-370) lands in
 * RAKHAL-385, folded into the flattened Finance tab bar by RAKHAL-382.
 */
export default async function FinanceTransactionsPage() {
  const t = await getTranslations();
  return (
    <PageCard title={t("finance.transactionsPage.title")}>
      <EmptyState icon={Receipt} title={t("common.comingSoonTitle")} description={t("common.comingSoonDescription")} />
    </PageCard>
  );
}
