import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@/components/shared/page-card";
import { CattleDetailView } from "@/features/cattle/components/detail/cattle-detail-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cattle.detail");
  return { title: `${t("title")} — Rakhal`, robots: { index: false } };
}

/**
 * RFE-023 — Cattle detail page. Figma (`rakhal-ui-analysis.md` B1-S5, decision D-2) pictures this
 * as a right-side drawer with route-backed deep links (an intercepted route); built as a plain
 * page instead — the ticket's own file scope (`app/(app)/cattle/[id]/**`) matches a page route,
 * and this codebase has no other intercepted-route precedent yet, so a full drawer/parallel-route
 * implementation would be new infra risk for one screen. Flagged, not silently swapped.
 */
export default async function CattleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("cattle.detail");

  return (
    <PageCard title={t("title")}>
      <CattleDetailView cattleId={id} />
    </PageCard>
  );
}
