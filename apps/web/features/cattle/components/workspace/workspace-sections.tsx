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
import { SECTIONS, type SectionKey } from "./section-state";
import { StateColumn, type DrillKey } from "./state-cards/state-column";
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
    <div role="tablist" aria-label={t("sectionsLabel")} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
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
            "h-10 shrink-0 rounded-lg px-4 text-sm font-medium transition-colors",
            value === key ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-muted",
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
}: {
  section: SectionKey;
  cattle: CattleDetail;
  drill: DrillKey | null;
  onDrill: (key: DrillKey | null) => void;
  canRecord: boolean;
  /** Record on a Next-up card: opens that event form (`?record=<key>&ref=<id>`). */
  onRecord: (key: EventKey, ref: string) => void;
}) {
  return (
    <div id="workspace-panel" role="tabpanel" aria-labelledby={`workspace-tab-${section}`} className="flex flex-col gap-4">
      {section === "timeline" ? (
        <>
          <NextUp cattleId={cattle.id} animal={{ id: cattle.id, tagNumber: cattle.tagNumber, name: cattle.name }} canRecord={canRecord} onRecord={onRecord} />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
            <div className="order-last lg:order-none">
              <AnimalTimeline cattleId={cattle.id} gender={cattle.gender} animalCategory={cattle.animalCategory} />
            </div>
            <div className="lg:sticky lg:top-0">
              <StateColumn cattle={cattle} drill={drill} onDrill={onDrill} />
            </div>
          </div>
        </>
      ) : null}
      {section === "feeding" ? <FeedingTab cattleId={cattle.id} animalCategory={cattle.animalCategory} /> : null}
      {section === "family" ? <PedigreeTab cattleId={cattle.id} /> : null}
      {section === "money" ? <FinanceTab cattleId={cattle.id} /> : null}
    </div>
  );
}
