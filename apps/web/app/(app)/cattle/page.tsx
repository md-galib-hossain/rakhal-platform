import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@/components/shared/page-card";
import { CattleHighlightsBar } from "@/features/cattle/components/cattle-highlights-bar";
import { CattleFilters } from "@/features/cattle/components/cattle-filters";
import { CattleTable } from "@/features/cattle/components/cattle-table";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("cattle")} — Rakhal`, robots: { index: false } };
}

/**
 * RFE-021 — Cattle list + highlights + bulk ops. Highlights (`GET /cattle/highlights`) and the
 * cursor-paginated list (`GET /cattle`) are separate real backend routes, both `cattle.read`-gated;
 * bulk ops (`POST /cattle/bulk`) require `cattle.bulk`. Filters/search are URL-synced (`nuqs`, via
 * the shared `FilterBar`), so `CattleFilters` and `CattleTable` read the same query string without
 * prop-drilling between them. Cattle detail (RFE-023) and add/edit (RFE-022) aren't built yet — the
 * list intentionally doesn't link out to either.
 *
 * **Parent-card wrapper (2026-07-11, user request):** the whole page now sits inside one
 * `PageCard` (`components/shared/page-card.tsx`), same pattern as `/dashboard` — no `actions` slot
 * here (no date picker/filter belongs at this level; `CattleFilters` already owns its own search
 * bar further down).
 */
export default async function CattlePage() {
  const t = await getTranslations("nav");

  return (
    <PageCard title={t("cattle")}>
      <CattleHighlightsBar />
      <Suspense fallback={null}>
        <CattleFilters />
        <CattleTable />
      </Suspense>
    </PageCard>
  );
}
