import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@rakhal/ui/shared/page-card";
import { SalesView } from "@/features/sales/components/sales-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("sales")} — Rakhal`, robots: { index: false } };
}

/**
 * RAKHAL-388 (MILESTONE 22) — Sales module: `Overview | Invoices | Dispatches`
 * (`BUSINESS_IA_PRD.md` §5.7-§5.9), replacing RAKHAL-357's scaffold (a bare wizard-trigger page,
 * its own doc comment said plainly this route would be "folded away or repurposed" once the real
 * IA landed). Same `PageCard title={...}` + feature-view-owns-its-own-tabs shape
 * `PurchasingPage`/`PurchasingView` already establish.
 */
export default async function SalesPage() {
  const t = await getTranslations("nav");
  return (
    <PageCard title={t("sales")}>
      <SalesView />
    </PageCard>
  );
}
