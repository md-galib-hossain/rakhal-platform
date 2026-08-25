import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@/components/shared/page-card";
import { RecordSaleTrigger } from "@/features/sales/components/record-sale-trigger";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("sales.record");
  return { title: `${t("title")} — Rakhal`, robots: { index: false } };
}

/**
 * RAKHAL-357 — standalone page hosting the Record Sale wizard's trigger, so the wizard is
 * reachable for verification this session without touching `app/(app)/finance/**`
 * (claimed by parallel RAKHAL-356/360 agents). RAKHAL-361 is the ticket that wires real domain
 * entry points (Cattle profile → Sell, Milk → Sell Milk, Inventory item → Sell all, Finance
 * page's own header) into this same wizard and is expected to fold this route away or repurpose
 * it — this page is a working surface, not the final IA.
 */
export default async function SalesPage() {
  const t = await getTranslations("sales.record");
  return (
    <PageCard title={t("title")} actions={<RecordSaleTrigger />}>
      <p className="text-sm text-muted-foreground">{t("pageDescription")}</p>
    </PageCard>
  );
}
