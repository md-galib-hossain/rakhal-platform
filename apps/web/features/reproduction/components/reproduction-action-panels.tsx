"use client"; // live query + row action buttons

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { AnimalLink } from "@/components/shared/animal-link";
import { DateText } from "@/components/shared/date-text";
import { useReproductionDashboard } from "../hooks/use-reproduction";
import type {
  CalvingNext7DaysRow,
  DryoffDue14DaysRow,
  InHeatNowRow,
  PregnancyCheckDueRow,
  ReadyForAiRow,
} from "../types";
import { ReproductionCard } from "./reproduction-card";

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0">{children}</div>;
}

function CowLabel({ cattleId, name, tag }: { cattleId: string; name: string | null; tag: string }) {
  return (
    <AnimalLink id={cattleId} animalName={name} tagNumber={tag} className="flex flex-col text-left group font-normal">
      <span className="text-sm font-medium text-foreground group-hover:underline">{name ?? tag}</span>
      {name ? <span className="text-xs text-muted-foreground">{tag}</span> : null}
    </AnimalLink>
  );
}

export interface ReproductionActionPanelsProps {
  onRecordAi: (cattleId: string) => void;
  onRecordPregnancyCheck: (cattleId: string, breedingEventId?: string) => void;
  onReturnToHeat: (breedingEventId: string) => void;
  onRecordCalving: (cattleId: string, pregnancyId?: string) => void;
  onRecordDryOff: (cattleId: string) => void;
}

/** "Cows Needing Action Today" (PRD §9.2) — 5 panels from the real dashboard's `action_required`.
 * No Figma frames for this module; laid out as a card-per-panel grid matching this app's other
 * dashboard widget density (Milk/Cattle), not a single cramped list. Dry-off now has a real backend
 * route (RD-038, `POST /reproduction/cattle/:id/dry-off`) — that panel gained an action button. */
export function ReproductionActionPanels({
  onRecordAi,
  onRecordPregnancyCheck,
  onReturnToHeat,
  onRecordCalving,
  onRecordDryOff,
}: ReproductionActionPanelsProps) {
  const t = useTranslations("reproduction.actionPanels");
  const dashboard = useReproductionDashboard();

  if (dashboard.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={4} />
      </div>
    );
  }
  if (dashboard.isError) {
    return <ErrorState description={t("error")} onRetry={() => dashboard.refetch()} />;
  }

  const action = dashboard.data?.action_required;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <ReproductionCard title={t("readyForAi")}>
        <PanelList
          rows={action?.ready_for_ai ?? []}
          emptyLabel={t("emptyReadyForAi")}
          renderRow={(row: ReadyForAiRow) => (
            <Row key={row.cattle_id}>
              <CowLabel cattleId={row.cattle_id} name={row.name} tag={row.tag} />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{t("daysOpen", { value: row.days_open ?? 0 })}</span>
                <Button size="sm" variant="outline" onClick={() => onRecordAi(row.cattle_id)}>
                  {t("recordAi")}
                </Button>
              </div>
            </Row>
          )}
        />
      </ReproductionCard>

      <ReproductionCard title={t("inHeatNow")}>
        <PanelList
          rows={action?.in_heat_now ?? []}
          emptyLabel={t("emptyInHeatNow")}
          renderRow={(row: InHeatNowRow) => (
            <Row key={row.cattle_id}>
              <CowLabel cattleId={row.cattle_id} name={row.name} tag={row.tag} />
              <div className="flex items-center gap-2">
                <DateText date={row.heat_observed_at} relative className="text-xs text-muted-foreground" />
                <Button size="sm" variant="outline" onClick={() => onRecordAi(row.cattle_id)}>
                  {t("recordAi")}
                </Button>
              </div>
            </Row>
          )}
        />
      </ReproductionCard>

      <ReproductionCard title={t("pregnancyCheckDue")}>
        <PanelList
          rows={action?.pregnancy_check_due ?? []}
          emptyLabel={t("emptyPregnancyCheckDue")}
          renderRow={(row: PregnancyCheckDueRow) => (
            <Row key={row.cattle_id}>
              <CowLabel cattleId={row.cattle_id} name={row.name} tag={row.tag} />
              <div className="flex items-center gap-2">
                <DateText date={row.ai_date} className="text-xs text-muted-foreground" />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onReturnToHeat(row.breeding_event_id)}
                >
                  {t("returnToHeat")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRecordPregnancyCheck(row.cattle_id, row.breeding_event_id)}
                >
                  {t("recordCheck")}
                </Button>
              </div>
            </Row>
          )}
        />
      </ReproductionCard>

      <ReproductionCard title={t("calvingNext7Days")}>
        <PanelList
          rows={action?.calving_next_7_days ?? []}
          emptyLabel={t("emptyCalvingNext7Days")}
          renderRow={(row: CalvingNext7DaysRow) => (
            <Row key={row.cattle_id}>
              <CowLabel cattleId={row.cattle_id} name={row.name} tag={row.tag} />
              <div className="flex items-center gap-2">
                <span
                  className={
                    row.days_remaining != null && row.days_remaining < 0
                      ? "text-xs font-medium text-destructive"
                      : "text-xs text-muted-foreground"
                  }
                >
                  {row.days_remaining == null
                    ? "—"
                    : row.days_remaining < 0
                      ? t("daysOverdue", { value: Math.abs(row.days_remaining) })
                      : t("daysRemaining", { value: row.days_remaining })}
                </span>
                <Button size="sm" variant="outline" onClick={() => onRecordCalving(row.cattle_id, row.pregnancy_id)}>
                  {t("recordCalving")}
                </Button>
              </div>
            </Row>
          )}
        />
      </ReproductionCard>

      <ReproductionCard title={t("dryoffDue14Days")} className="sm:col-span-2">
        <PanelList
          rows={action?.dryoff_due_14_days ?? []}
          emptyLabel={t("emptyDryoffDue14Days")}
          renderRow={(row: DryoffDue14DaysRow) => (
            <Row key={row.cattle_id}>
              <CowLabel cattleId={row.cattle_id} name={row.name} tag={row.tag} />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {t("dryoffTarget")} <DateText date={row.dryoff_target_date} />
                </span>
                <Button size="sm" variant="outline" onClick={() => onRecordDryOff(row.cattle_id)}>
                  {t("recordDryOff")}
                </Button>
              </div>
            </Row>
          )}
        />
      </ReproductionCard>
    </div>
  );
}

function PanelList<T>({
  rows,
  emptyLabel,
  renderRow,
}: {
  rows: T[];
  emptyLabel: string;
  renderRow: (row: T) => React.ReactNode;
}) {
  if (rows.length === 0) return <EmptyState title={emptyLabel} className="py-6" />;
  return <div className="flex flex-col">{rows.map(renderRow)}</div>;
}
