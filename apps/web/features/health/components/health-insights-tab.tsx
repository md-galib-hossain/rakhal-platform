"use client"; // owns the period shared by the trend chart and the outcomes

import { useState } from "react";
import { HealthOutcomesCard } from "./health-outcomes-card";
import { InsightsRangePicker, type InsightsRange } from "./insights-range";
import { MorbidityTrendChart } from "./morbidity-trend-chart";

/**
 * RFE-140 (MILESTONE 29c) — "Insights": the morbidity trend and the farm outcomes, moved off the top of the Healthcare
 * page so it opens on the work. Only mounted when the tab is open, so the chart bundle and the outcomes query are not
 * paid for by everyone who just wants the sick-bay list. Both cards render `plain` (no second border inside the
 * Management Center card).
 *
 * One period control at the top drives both cards, so the chart and the figures below it always describe the same
 * stretch of time (they used to have a static "All time" label and a separate, different picker).
 */
export function HealthInsightsTab() {
  const [range, setRange] = useState<InsightsRange>("90");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <InsightsRangePicker value={range} onChange={setRange} />
      </div>
      <MorbidityTrendChart plain range={range} />
      <div className="border-t border-dashed border-border pt-6">
        <HealthOutcomesCard plain range={range} />
      </div>
    </div>
  );
}
