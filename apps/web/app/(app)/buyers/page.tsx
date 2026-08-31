import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@/components/shared/page-card";
import { BuyersTabs } from "@/features/buyers/components/buyers-tabs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("buyers")} — Rakhal`, robots: { index: false } };
}

/** Milk Buyers (RFE-026, RAKHAL-389 MILESTONE 22, PRD §11 / API §7 / `BUSINESS_IA_PRD.md` §5.10).
 * Tabs `Buyers | Buyer Groups` — the global Dispatch History tab moved to Sales → Dispatches
 * (RAKHAL-388); a per-buyer Dispatches tab still lives on the new `/buyers/:id` detail page. */
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
