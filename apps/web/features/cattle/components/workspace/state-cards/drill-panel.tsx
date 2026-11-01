"use client"; // button handler

import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HealthTab } from "../../detail/health-tab";
import { PerformanceTab } from "../../detail/performance-tab";
import { ReproductionTab } from "../../detail/reproduction-tab";
import type { CattleDetail } from "../../../types";
import type { CardKey } from "./applicability";

/**
 * Drill panel (RFE-156): "View" on a state card swaps the right column for the full history of that domain, reusing
 * the existing tab bodies (charts, tables) rather than duplicating them. Esc or Back returns (the workspace owns Esc).
 * It replaces the main track of the workspace grid (from 1400px it also takes the Next-up track); under 720px it
 * replaces the whole body. It lives in the grid, never in the rail, and is not `fixed` (the `@container` would re-anchor it).
 */
export function DrillPanel({ cattle, drill, onBack }: { cattle: CattleDetail; drill: CardKey; onBack: () => void }) {
  const t = useTranslations("events.cards");
  const tw = useTranslations("events.workspace");
  return (
    <section
      aria-labelledby="workspace-drill-title"
      className="flex min-w-0 flex-col gap-3"
    >
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-card py-1">
        <Button type="button" variant="ghost" size="sm" className="-ml-2 h-10 gap-1 px-2" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden />
          {tw("back")}
        </Button>
        <h3 id="workspace-drill-title" className="text-sm font-semibold text-foreground">
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
