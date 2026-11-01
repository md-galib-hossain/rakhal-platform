"use client"; // renders cards that own their live queries

import type { CattleDetail } from "../../../types";
import { applicableCards, type CardKey } from "./applicability";
import { GrowthCard, HealthCard, MilkCard, ReproductionCard } from "./state-cards";

export type DrillKey = CardKey;

/** Rail of the Timeline section (RFE-156): the applicable state cards. The drill panel renders in the main track (RFE-176), never here. */
export function StateColumn({
  cattle,
  onDrill,
}: {
  cattle: CattleDetail;
  onDrill: (key: DrillKey | null) => void;
}) {
  const cards = applicableCards(cattle);
  return (
    // Under 720px: one snap-scroll row of cards (05 §3.3). From 720px: a vertical rail (container query, RFE-176).
    <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 @min-[720px]/ws:mx-0 @min-[720px]/ws:grid @min-[720px]/ws:snap-none @min-[720px]/ws:grid-cols-1 @min-[720px]/ws:overflow-visible @min-[720px]/ws:px-0 @min-[720px]/ws:pb-0 [&>*]:w-[72%] [&>*]:min-w-0 [&>*]:shrink-0 [&>*]:snap-start @min-[720px]/ws:[&>*]:w-auto">
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
