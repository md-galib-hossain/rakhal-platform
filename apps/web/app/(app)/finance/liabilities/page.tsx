import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@rakhal/ui/shared/page-card";
import { LiabilitiesView } from "@/features/finance/components/liabilities-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("finance.liabilitiesPage");
  return { title: `${t("title")} — Rakhal`, robots: { index: false } };
}

/**
 * RAKHAL-382 (MILESTONE 22) — relocates the existing V1 Liabilities tab content here as a
 * URL-only route, same precedent `/finance/accounts` already set. `LiabilitiesView` itself is
 * untouched (RAKHAL-382's lane doesn't include `liabilities-view.tsx`) — this page just gives it a
 * new home now that the Finance tab bar no longer has a `liabilities` tab. `FinanceLoan` (RD-063)
 * keeps its only UI; nothing is orphaned.
 */
export default async function FinanceLiabilitiesPage() {
  const t = await getTranslations("finance.liabilitiesPage");
  return (
    <PageCard title={t("title")}>
      <LiabilitiesView />
    </PageCard>
  );
}
