import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@rakhal/ui/shared/page-card";
import { AssetDistributionView } from "@/features/finance/components/asset-distribution-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("finance.assetsPage");
  return { title: `${t("title")} — Rakhal`, robots: { index: false } };
}

/**
 * RAKHAL-382 (MILESTONE 22) — relocates the existing V1 Asset Distribution tab content here as a
 * URL-only route, same precedent `/finance/accounts` already set. `AssetDistributionView` itself
 * is untouched (RAKHAL-382's lane doesn't include `asset-distribution-view.tsx`) — this page just
 * gives it a new home now that the Finance tab bar no longer has an `assets` tab. `FixedAsset`
 * (RD-063) keeps its only UI; nothing is orphaned.
 */
export default async function FinanceAssetsPage() {
  const t = await getTranslations("finance.assetsPage");
  return (
    <PageCard title={t("title")}>
      <AssetDistributionView />
    </PageCard>
  );
}
