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
 * Below `lg` it is a full-screen push; at `lg` it sits in the column.
 */
export function DrillPanel({ cattle, drill, onBack }: { cattle: CattleDetail; drill: CardKey; onBack: () => void }) {
  const t = useTranslations("events.cards");
  const tw = useTranslations("events.workspace");
  return (
    <section
      aria-labelledby="workspace-drill-title"
      className="fixed inset-0 z-[60] flex flex-col gap-3 overflow-y-auto bg-card p-4 lg:static lg:z-auto lg:overflow-visible lg:p-0"
    >
      <div className="flex items-center gap-2">
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
