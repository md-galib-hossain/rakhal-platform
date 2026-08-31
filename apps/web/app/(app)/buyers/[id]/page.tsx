import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BuyerDetailView } from "@/features/buyers/components/detail/buyer-detail-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("buyers")} — Rakhal`, robots: { index: false } };
}

/** RAKHAL-389 (MILESTONE 22) — buyer detail page (`BUSINESS_IA_PRD.md` §5.11). Deliberately no
 * `PageCard` wrapper here (unlike `SalesPage`/`PurchasingPage`) — `BuyerDetailView` builds its own
 * dynamic per-buyer header (back link + real buyer name + stats), which a static `PageCard title`
 * would only duplicate or fight with. */
export default async function BuyerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <Suspense fallback={null}>
        <BuyerDetailView buyerId={id} />
      </Suspense>
    </div>
  );
}
