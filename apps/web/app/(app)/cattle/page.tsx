import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@/components/shared/page-card";
import { CattleHighlightsBar } from "@/features/cattle/components/cattle-highlights-bar";
import { CattleFilters } from "@/features/cattle/components/cattle-filters";
import { CattleTable } from "@/features/cattle/components/cattle-table";
import { CattleAddButton } from "@/features/cattle/components/cattle-add-button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("cattle")} — Rakhal`, robots: { index: false } };
}

/**
 * RFE-021 — Cattle list + highlights + bulk ops. Highlights (`GET /cattle/highlights`) and the
 * numbered-page list (`GET /cattle`, cursor under the hood via `useCattlePagedList`) are separate
 * real backend routes, both `cattle.read`-gated; bulk ops (`POST /cattle/bulk`) require
 * `cattle.bulk`. Filters/search are URL-synced (`nuqs`, via the shared `FilterBar`), so
 * `CattleFilters` and `CattleTable` read the same query string without prop-drilling between them.
 *
 * **Pixel-perfect pass (2026-07-12, user request + Figma "Cattle" frame):** the page now mirrors
 * Figma's two-heading layout — the outer `PageCard` ("Cattle") holds the "Cattle Highlights" card
 * plus a second "All Cattle View" section whose header row carries search/filter/`CattleAddButton`
 * together (moved out of `PageCard`'s top-level `actions` slot to match).
 */
export default async function CattlePage() {
  const t = await getTranslations("nav");
  const tCattle = await getTranslations("cattle");

  return (
    <PageCard title={t("cattle")}>
      <CattleHighlightsBar />
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-foreground">{tCattle("allCattleView")}</h2>
          <Suspense fallback={null}>
            <CattleFilters actions={<CattleAddButton />} />
          </Suspense>
        </div>
        <Suspense fallback={null}>
          <CattleTable />
        </Suspense>
      </div>
    </PageCard>
  );
}
