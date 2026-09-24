import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@/components/shared/page-card";
import { CattleHighlightsBar } from "@/features/cattle/components/cattle-highlights-bar";
import { CattleFilters } from "@/features/cattle/components/cattle-filters";
import { CattleTable } from "@/features/cattle/components/cattle-table";
import { CattleAddButton } from "@/features/cattle/components/cattle-add-button";
import { CattleImportButton } from "@/features/cattle/components/cattle-import-button";
import { AnimalGroupsButton } from "@/features/cattle/components/animal-groups-button";
import { CalfKpiBanner } from "@/features/cattle/components/calf-kpi-banner";
import { ReportExportButton } from "@/features/reports/components/report-export-button";
import { CATTLE_EXPORT_REPORT } from "@/features/reports/report-defs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("animals")} — Rakhal`, robots: { index: false } };
}

/**
 * RFE-021 — Cattle/Animal list + highlights + bulk ops. Highlights (`GET /cattle/highlights`) and
 * the numbered-page list (`GET /cattle`, cursor under the hood via `useCattlePagedList`) are
 * separate real backend routes, both `cattle.read`-gated; bulk ops (`POST /cattle/bulk`) require
 * `cattle.bulk`. Filters/search are URL-synced (`nuqs`, via the shared `FilterBar`), so
 * `CattleFilters` and `CattleTable` read the same query string without prop-drilling between them.
 *
 * **Pixel-perfect pass (2026-07-12, user request + Figma "Cattle" frame):** the page mirrors
 * Figma's two-heading layout — the outer `PageCard` ("Animal") holds the "Animal Highlights" card
 * plus a second "All Animals" section whose header row carries search/filter/`CattleAddButton`
 * together (moved out of `PageCard`'s top-level `actions` slot to match).
 *
 * **Cattle→Animal rename + Calves merge (no ticket #):** the standalone `/calves` page is gone —
 * a calf is just a `Cattle` row with `animalCategory: "CALF"`, so `CattleFilters`' new
 * `animalCategory` select (backed by the same real backend param the category-highlight tiles
 * already used) IS the calf filter now. `CalfKpiBanner` surfaces the Calves module's own KPI row
 * only while that filter is active, and `CattleDetailTabs` appends the calf-rearing tabs
 * (colostrum/milk/weight/starter-feed/tasks) only for CALF-category animals — see that file.
 */
export default async function CattlePage() {
  const t = await getTranslations("nav");
  const tCattle = await getTranslations("cattle");

  return (
    <PageCard title={t("animals")}>
      <CattleHighlightsBar />
      <Suspense fallback={null}>
        <CalfKpiBanner />
      </Suspense>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-foreground">{tCattle("allCattleView")}</h2>
          <Suspense fallback={null}>
            <CattleFilters
              actions={
                <div className="flex items-center gap-2">
                  <ReportExportButton report={CATTLE_EXPORT_REPORT} size="md" />
                  <CattleImportButton />
                  <AnimalGroupsButton />
                  <CattleAddButton />
                </div>
              }
            />
          </Suspense>
        </div>
        <Suspense fallback={null}>
          <CattleTable />
        </Suspense>
      </div>
    </PageCard>
  );
}
