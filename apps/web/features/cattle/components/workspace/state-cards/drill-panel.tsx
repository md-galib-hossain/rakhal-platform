"use client"; // button handler

import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { HealthTab } from "../../detail/health-tab";
import { PerformanceTab } from "../../detail/performance-tab";
import { ReproductionTab } from "../../detail/reproduction-tab";
import type { CattleDetail } from "../../../types";
import type { CardKey } from "./applicability";

/**
 * Shared drill panel (RFE-182): "View" on an Overview card swaps the main column for that domain's full history.
 * One template for Milk, Growth, Reproduction and Health: back link, title, then a body built from the shared
 * `DrillStats` (auto-fit `minmax(140px, 1fr)` tiles) and `DrillCard`s (charts / tables full width) in
 * `../drill/drill-template`. Esc or Back returns (the workspace owns Esc). It replaces the main track of the
 * workspace grid, never the narrow rail; under 720px it replaces the whole body (full screen on a phone).
 * Not `fixed` (the `@container` would re-anchor it).
 */
export function DrillPanel({ cattle, drill, onBack }: { cattle: CattleDetail; drill: CardKey; onBack: () => void }) {
  const t = useTranslations("events.cards");
  const tw = useTranslations("events.workspace");
  return (
    <section aria-labelledby="workspace-drill-title" className="mx-auto flex w-full min-w-0 max-w-[1240px] flex-col gap-4">
      <div className="sticky top-0 z-10 flex flex-col gap-1 bg-card pb-2">
        <button
          type="button"
          onClick={onBack}
          className="-ml-2 inline-flex min-h-10 w-fit items-center gap-1 rounded-md px-2 text-sm font-medium text-primary outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {tw("back")}
        </button>
        <h3 id="workspace-drill-title" className="text-xl font-semibold text-foreground">
          {t(`${drill}.title`)}
        </h3>
      </div>
      {drill === "reproduction" ? (
        <ReproductionTab cattleId={cattle.id} gender={cattle.gender} animalCategory={cattle.animalCategory} />
      ) : null}
      {drill === "health" ? <HealthTab cattleId={cattle.id} /> : null}
      {drill === "milk" || drill === "growth" ? (
        <PerformanceTab
          cattleId={cattle.id}
          gender={cattle.gender}
          lactationStage={cattle.lactationStage}
          animalCategory={cattle.animalCategory}
        />
      ) : null}
    </section>
  );
}
