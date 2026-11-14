import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@rakhal/ui/shared/page-card";
import { InventoryView } from "@/features/inventory/components/inventory-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("inventory")} — Rakhal`, robots: { index: false } };
}

/** Inventory — Figma "Inventory" frame (732:12409/732:11796/732:11067, file `SCfMPdxP6vgW1uTxfqCtz7`):
 * 5-tab bar (Medicine/Feed/Semen/Milk/Others) + grid/list view toggle — see `InventoryView`'s doc
 * comment. Feed is one tab with two views (Purchased/Prepared), since feed is the umbrella term. */
export default async function InventoryPage() {
  const t = await getTranslations("nav");
  return (
    <PageCard title={t("inventory")}>
      <Suspense fallback={null}>
        <InventoryView />
      </Suspense>
    </PageCard>
  );
}
