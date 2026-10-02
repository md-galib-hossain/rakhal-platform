import { HealthOutcomesCard } from "./health-outcomes-card";
import { MorbidityTrendChart } from "./morbidity-trend-chart";

/**
 * RFE-140 (MILESTONE 29c) — "Insights": the morbidity trend and the farm outcomes, moved off the top of the Healthcare
 * page so it opens on the work. Only mounted when the tab is open, so the chart bundle and the outcomes query are not
 * paid for by everyone who just wants the sick-bay list. Both cards render `plain` (no second border inside the
 * Management Center card).
 */
export function HealthInsightsTab() {
  return (
    <div className="flex flex-col gap-8">
      <MorbidityTrendChart plain />
      <div className="border-t border-dashed border-border pt-6">
        <HealthOutcomesCard plain />
      </div>
    </div>
  );
}
