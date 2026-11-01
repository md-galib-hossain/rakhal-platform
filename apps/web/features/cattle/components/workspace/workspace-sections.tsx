"use client"; // section state is URL-synced by the parent; this file only renders

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { NextUp } from "@/features/events/components/next-up/next-up";
import type { EventKey } from "@/features/events/types";
// eslint-disable-next-line import/no-cycle -- feeding/family tabs link to other animals through the detail-modal provider
import { FeedingTab } from "../detail/feeding-tab";
import { PedigreeTab } from "../detail/pedigree-tab";
import { FinanceTab } from "../detail/finance-tab";
import type { CattleDetail } from "../../types";
import { WS_AREA_NEXT, WS_AREA_RAIL, WS_AREA_TIME, WS_CONTAINER, WS_GRID, WS_GRID_DRILL, WS_OVERVIEW_COLUMN, WS_OVERVIEW_GRID, WS_OVERVIEW_SCROLLER, WS_SCROLLER } from "./workspace-grid";
import { SECTIONS, type SectionKey } from "./section-state";
import { StateColumn, type DrillKey } from "./state-cards/state-column";
import { applicableCards } from "./state-cards/applicability";
import { DrillPanel } from "./state-cards/drill-panel";
import { OverviewMain } from "./overview/overview-section";
import { AtAGlance } from "./overview/at-a-glance";
import { AnimalTimeline } from "@/features/events/components/timeline/animal-timeline";

/** One scrollable row, never wraps (03 §3.3) — replaces the old 8-tab grid that wrapped to 4 rows at 375px. */
export function SectionSwitcher({
  value,
  canSeeMoney,
  onChange,
}: {
  value: SectionKey;
  canSeeMoney: boolean;
  onChange: (section: SectionKey) => void;
}) {
  const t = useTranslations("events.workspace");
  const visible = SECTIONS.filter((key) => key !== "money" || canSeeMoney);
  return (
    <div role="tablist" aria-label={t("sectionsLabel")} className="flex shrink-0 gap-1 overflow-x-auto overscroll-x-contain border-b border-border [scrollbar-width:none] sm:gap-2 [&::-webkit-scrollbar]:hidden">
      {visible.map((key) => (
        <button
          key={key}
          type="button"
          role="tab"
          id={`workspace-tab-${key}`}
          aria-selected={value === key}
          aria-controls="workspace-panel"
          onClick={() => onChange(key)}
          className={cn(
            "-mb-px h-11 shrink-0 whitespace-nowrap border-b-2 px-3 text-sm outline-none transition-colors first:pl-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-4 sm:first:pl-0",
            value === key
              ? "border-primary font-semibold text-foreground"
              : "border-transparent font-medium text-muted-foreground hover:border-border hover:text-foreground",
          )}
        >
          {t(`sections.${key}`)}
        </button>
      ))}
    </div>
  );
}

export function SectionBody({
  section,
  cattle,
  drill,
  onDrill,
  canRecord,
  onRecord,
  onSeeAll,
}: {
  section: SectionKey;
  cattle: CattleDetail;
  drill: DrillKey | null;
  onDrill: (key: DrillKey | null) => void;
  canRecord: boolean;
  /** Record on a Next-up card: opens that event form (`?record=<key>&ref=<id>`). */
  onRecord: (key: EventKey, ref: string) => void;
  /** Overview "See all" → the Timeline section. */
  onSeeAll: () => void;
}) {
  const timeline = section === "timeline";
  const overview = section === "overview";
  const drilled = drill !== null && applicableCards(cattle).includes(drill);
  return (
    <div
      id="workspace-panel"
      role="tabpanel"
      aria-labelledby={`workspace-tab-${section}`}
      // The container for every `@…/ws:` rule below (RFE-176). The timeline section scrolls inside its own columns from
      // 720px, so the panel must not; every other section is one plain scroller.
      className={cn(WS_CONTAINER, "min-h-0 flex-1 pb-4", timeline || (overview && !drilled) ? "overflow-y-hidden" : "flex flex-col gap-4 overflow-y-auto")}
    >
      {timeline ? (
        <div className={WS_SCROLLER}>
          <div className={drilled ? WS_GRID_DRILL : WS_GRID}>
            {drilled ? null : (
              <div className={WS_AREA_NEXT}>
                <NextUp cattleId={cattle.id} animal={{ id: cattle.id, tagNumber: cattle.tagNumber, name: cattle.name }} canRecord={canRecord} onRecord={onRecord} />
              </div>
            )}
            <div className={cn(WS_AREA_RAIL, drilled && "hidden @min-[720px]/ws:block")}>
              <StateColumn cattle={cattle} onDrill={onDrill} />
            </div>
            <div className={WS_AREA_TIME}>
              {drilled && drill ? (
                <DrillPanel cattle={cattle} drill={drill} onBack={() => onDrill(null)} />
              ) : (
                <AnimalTimeline cattleId={cattle.id} />
              )}
            </div>
          </div>
        </div>
      ) : null}
      {overview && drilled && drill ? <DrillPanel cattle={cattle} drill={drill} onBack={() => onDrill(null)} /> : null}
      {overview && !(drilled && drill) ? (
        <div className={WS_OVERVIEW_SCROLLER}>
          <div className={WS_OVERVIEW_GRID}>
            <div className={WS_OVERVIEW_COLUMN}>
              <OverviewMain cattle={cattle} canRecord={canRecord} onRecord={(key) => onRecord(key, "")} onDrill={onDrill} onSeeAll={onSeeAll} />
            </div>
            <aside className={cn(WS_OVERVIEW_COLUMN, "flex flex-col gap-6")}>
              <NextUp cattleId={cattle.id} animal={{ id: cattle.id, tagNumber: cattle.tagNumber, name: cattle.name }} canRecord={canRecord} onRecord={onRecord} />
              <AtAGlance cattle={cattle} />
            </aside>
          </div>
        </div>
      ) : null}
      {section === "feeding" ? <FeedingTab cattleId={cattle.id} animalCategory={cattle.animalCategory} /> : null}
      {section === "family" ? <PedigreeTab cattleId={cattle.id} /> : null}
      {section === "money" ? <FinanceTab cattleId={cattle.id} /> : null}
    </div>
  );
}
