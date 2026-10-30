"use client"; // renders cards that own their live queries

import type { CattleDetail } from "../../../types";
import { applicableCards, type CardKey } from "./applicability";
import { DrillPanel } from "./drill-panel";
import { GrowthCard, HealthCard, MilkCard, ReproductionCard } from "./state-cards";

export type DrillKey = CardKey;

/** Right column of the Timeline section (RFE-156): applicable state cards, or the drill panel for one of them. */
export function StateColumn({
  cattle,
  drill,
  onDrill,
}: {
  cattle: CattleDetail;
  drill: DrillKey | null;
  onDrill: (key: DrillKey | null) => void;
}) {
  const cards = applicableCards(cattle);
  if (drill && cards.includes(drill)) {
    return <DrillPanel cattle={cattle} drill={drill} onBack={() => onDrill(null)} />;
  }
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
      {cards.map((key) => {
        const props = { cattle, onView: () => onDrill(key) };
        if (key === "reproduction") return <ReproductionCard key={key} {...props} />;
        if (key === "milk") return <MilkCard key={key} {...props} />;
        if (key === "health") return <HealthCard key={key} {...props} />;
        return <GrowthCard key={key} {...props} />;
      })}
    </div>
  );
}
