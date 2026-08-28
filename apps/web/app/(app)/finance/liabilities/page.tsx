import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Wallet } from "lucide-react";
import { PageCard } from "@/components/shared/page-card";
import { EmptyState } from "@/components/shared/empty-state";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("finance.liabilitiesPage");
  return { title: `${t("title")} — Rakhal`, robots: { index: false } };
}

/**
 * RAKHAL-381 — route scaffold only (MILESTONE 22, Phase D). RAKHAL-382 relocates the existing V1
 * Liabilities tab content here as a URL-only route (same precedent `/finance/accounts` already
 * set) — nothing is orphaned, `FinanceLoan` (RD-063) keeps its only UI.
 */
export default async function FinanceLiabilitiesPage() {
  const t = await getTranslations();
  return (
    <PageCard title={t("finance.liabilitiesPage.title")}>
      <EmptyState icon={Wallet} title={t("common.comingSoonTitle")} description={t("common.comingSoonDescription")} />
    </PageCard>
  );
}
