import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@/components/shared/page-card";
import { InventoryView } from "@/features/inventory/components/inventory-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("inventory")} — Rakhal`, robots: { index: false } };
}

/** Inventory — Figma "Inventory" frame (732:12409/732:11796/732:11067, file `SCfMPdxP6vgW1uTxfqCtz7`):
 * 5-category tab bar (Medicine/Forage/Semen/Milk/Others) + grid/list view toggle. Only the
 * Medicine tab is wired to a real backend flow this pass — see `InventoryView`'s doc comment. */
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
