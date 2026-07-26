import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { PageCard } from "@/components/shared/page-card";
import { CalvesKpiCards } from "@/features/calves/components/calves-kpi-cards";
import { CalvesFilters } from "@/features/calves/components/calves-filters";
import { CalvesTable } from "@/features/calves/components/calves-table";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: `${t("calves")} — Rakhal`, robots: { index: false } };
}

/**
 * RFE-033 — Calves module (PRD §14, API §10). No Figma frames for this module — the layout follows
 * the same widget-grid pattern already shipped for Milk/Cattle/Reproduction: KPI row, filters+table,
 * calf-profile detail sheet with per-tab log actions. All data from the real backend
 * (`calf.controller.ts`/`calf.service.ts`), no mocks. There is no `calf.create` route — calves
 * originate only from Reproduction's calving-event flow — so deliberately no "Add Calf" button here.
 * Replaces the placeholder `RouteStub` this route previously rendered.
 */
export default async function CalvesPage() {
  const t = await getTranslations("nav");
  const tCalves = await getTranslations("calves");

  return (
    <PageCard title={t("calves")}>
      <CalvesKpiCards />
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-foreground">{tCalves("allCalvesView")}</h2>
          <Suspense fallback={null}>
            <CalvesFilters />
          </Suspense>
        </div>
        <Suspense fallback={null}>
          <CalvesTable />
        </Suspense>
      </div>
    </PageCard>
  );
}
