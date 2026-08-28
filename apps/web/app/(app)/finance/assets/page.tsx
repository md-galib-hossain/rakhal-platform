import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Warehouse } from "lucide-react";
import { PageCard } from "@/components/shared/page-card";
import { EmptyState } from "@/components/shared/empty-state";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("finance.assetsPage");
  return { title: `${t("title")} — Rakhal`, robots: { index: false } };
}

/**
 * RAKHAL-381 — route scaffold only (MILESTONE 22, Phase D). RAKHAL-382 relocates the existing V1
 * Asset Distribution tab content here as a URL-only route (same precedent `/finance/accounts`
 * already set) — nothing is orphaned, `FixedAsset` (RD-063) keeps its only UI.
 */
export default async function FinanceAssetsPage() {
  const t = await getTranslations();
  return (
    <PageCard title={t("finance.assetsPage.title")}>
      <EmptyState icon={Warehouse} title={t("common.comingSoonTitle")} description={t("common.comingSoonDescription")} />
    </PageCard>
  );
}
