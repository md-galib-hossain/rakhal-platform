import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@/components/shared/page-card";
import { BuyersView } from "@/features/buyers/components/buyers-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("buyers")} — Rakhal`, robots: { index: false } };
}

/** Milk Buyers (RFE-026, RAKHAL-389 MILESTONE 22, PRD §11 / API §7 / `BUSINESS_IA_PRD.md` §5.10).
 * The "Buyer Groups" tab was removed per user request (no ticket #) — just the buyer list now,
 * the global Dispatch History tab already lives at Sales → Dispatches (RAKHAL-388); a per-buyer
 * Dispatches tab still lives on the `/buyers/:id` detail page. */
export default async function BuyersPage() {
  const t = await getTranslations("nav");
  return (
    <PageCard title={t("buyers")}>
      <Suspense fallback={null}>
        <BuyersView />
      </Suspense>
    </PageCard>
  );
}
