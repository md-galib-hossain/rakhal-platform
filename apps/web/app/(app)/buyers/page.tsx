import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@/components/shared/page-card";
import { BuyersTabs } from "@/features/buyers/components/buyers-tabs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("buyers")} — Rakhal`, robots: { index: false } };
}

/** Milk Buyers & Dispatch (RFE-026, PRD §11 / API §7). No Figma frames supplied for this module —
 * built PRD-spec against the real `buyer.controller.ts`/`milk-dispatch.controller.ts` contract.
 * Buyers tab (directory + create/edit/deactivate + per-row Record Dispatch/Statement) and Dispatch
 * History tab (all dispatches, filterable by buyer, standalone Record Dispatch entry point). */
export default async function BuyersPage() {
  const t = await getTranslations("nav");
  return (
    <PageCard title={t("buyers")}>
      <Suspense fallback={null}>
        <BuyersTabs />
      </Suspense>
    </PageCard>
  );
}
