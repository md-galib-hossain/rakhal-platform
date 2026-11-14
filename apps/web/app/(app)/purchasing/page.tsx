import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@rakhal/ui/shared/page-card";
import { PurchasingView } from "@/features/purchasing/components/purchasing-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("purchasing")} — Rakhal`, robots: { index: false } };
}

/**
 * Purchasing (RAKHAL-359, MILESTONE 21 Finance V2) — Expenses + Purchases, two deliberately separate
 * flows (`FINANCE_V2_DESIGN.md` §5.1). Backend twin RAKHAL-348/349 (`purchasing/purchases`,
 * `purchasing/expenses`, `purchasing/payables`), live and e2e-verified.
 */
export default async function PurchasingPage() {
  const t = await getTranslations("nav");
  return (
    <PageCard title={t("purchasing")}>
      <PurchasingView />
    </PageCard>
  );
}
