"use client"; // live query + tab / expand state + row action buttons

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CircleCheckBig } from "lucide-react";
import { Button } from "@rakhal/ui/ui/button";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@rakhal/ui/ui/tabs";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { DateText } from "@/components/shared/date-text";
import { InfiniteScrollFooter } from "@/components/shared/infinite-scroll-footer";
import { useIncrementalReveal } from "@/lib/hooks/use-incremental-reveal";
import { cn } from "@/lib/utils";
import { useReproductionDashboard } from "../hooks/use-reproduction";
import type {
  CalvingNext7DaysRow,
  DryoffDue14DaysRow,
  InHeatNowRow,
  PregnancyCheckDueRow,
  ReadyForAiRow,
} from "../types";
import { ReproductionCard } from "./reproduction-card";
import { ReproductionCowIdentity } from "./reproduction-cow-identity";

type TabKey = "readyForAi" | "inHeat" | "pregnancyCheck" | "calving" | "dryOff";
const TAB_ORDER: TabKey[] = ["readyForAi", "inHeat", "pregnancyCheck", "calving", "dryOff"];

const ATTENTION_STEP = 8;

export interface ReproductionActionPanelsProps {
  onRecordAi: (cattleId: string) => void;
  onRecordPregnancyCheck: (cattleId: string, breedingEventId?: string) => void;
  onReturnToHeat: (cattleId: string) => void;
  onRecordCalving: (cattleId: string, pregnancyId?: string) => void;
  onRecordDryOff: (cattleId: string) => void;
}

/**
 * "Needs Attention Today" (PRD §9.2).
 * Formatted to sit alongside the Calving Forecast in an equal-height 2-column grid.
 * Structured with high-density rows and clear action CTAs.
 */
export function ReproductionActionPanels({
  onRecordAi,
  onRecordPregnancyCheck,
  onReturnToHeat,
  onRecordCalving,
  onRecordDryOff,
}: ReproductionActionPanelsProps) {
  const t = useTranslations("reproduction.actionPanels");
  const dashboard = useReproductionDashboard();
  const [picked, setPicked] = useState<TabKey | null>(null);

  const action = dashboard.data?.action_required;
  const counts: Record<TabKey, number> = {
    readyForAi: action?.ready_for_ai.length ?? 0,
    inHeat: action?.in_heat_now.length ?? 0,
    pregnancyCheck: action?.pregnancy_check_due.length ?? 0,
    calving: action?.calving_next_7_days.length ?? 0,
    dryOff: action?.dryoff_due_14_days.length ?? 0,
  };
  const total = TAB_ORDER.reduce((sum, key) => sum + counts[key], 0);
  const activeTab = picked ?? TAB_ORDER.find((key) => counts[key] > 0) ?? "readyForAi";

  function selectTab(next: string) {
    setPicked(next as TabKey);
  }

  if (dashboard.isLoading) {
    return (
      <ReproductionCard title={t("title")} className="h-full">
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      </ReproductionCard>
    );
  }

  if (dashboard.isError) {
    return (
      <ReproductionCard title={t("title")} className="h-full">
        <ErrorState description={t("error")} onRetry={() => dashboard.refetch()} />
      </ReproductionCard>
    );
  }

  return (
    <ReproductionCard
      title={t("title")}
      description={total > 0 ? t("summary", { count: total }) : undefined}
      className="h-full min-h-[30rem]"
    >
      {total === 0 ? (
        <EmptyState
          icon={CircleCheckBig}
          title={t("allClear")}
          description={t("allClearHint")}
          className="flex-1 justify-center py-10"
        />
      ) : (
        <Tabs value={activeTab} onValueChange={selectTab} className="flex flex-1 flex-col gap-3">
          <TabsList
            aria-label={t("title")}
            className="w-full justify-start overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {TAB_ORDER.map((key) => (
              <TabsTrigger
                key={key}
                value={key}
                className="shrink-0"
              >
                {t(`tabs.${key}`)}
                <span
                  className={cn(
                    "ml-1.5 min-w-4.5 rounded-full px-1 text-center text-[0.7rem] font-bold leading-4",
                    counts[key] > 0
                      ? "bg-primary/15 text-primary"
                      : "bg-background/60 text-muted-foreground",
                  )}
                >
                  {counts[key]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="readyForAi" className="mt-0 flex flex-1 flex-col">
            <AttentionList
              rows={action?.ready_for_ai ?? []}
              emptyLabel={t("emptyReadyForAi")}
              renderRow={(row: ReadyForAiRow) => (
                <AttentionRow
                  key={row.cattle_id}
                  cow={row}
                  meta={<MetaPill tone="warning">{t("daysOpen", { value: row.days_open ?? 0 })}</MetaPill>}
                >
                  <Button size="sm" variant="secondary" onClick={() => onRecordAi(row.cattle_id)}>
                    {t("recordAi")}
                  </Button>
                </AttentionRow>
              )}
            />
          </TabsContent>

          <TabsContent value="inHeat" className="mt-0 flex flex-1 flex-col">
            <AttentionList
              rows={action?.in_heat_now ?? []}
              emptyLabel={t("emptyInHeatNow")}
              renderRow={(row: InHeatNowRow) => (
                <AttentionRow
                  key={row.cattle_id}
                  cow={row}
                  meta={
                    <MetaPill tone="warning">
                      <DateText date={row.heat_observed_at} relative />
                    </MetaPill>
                  }
                >
                  <Button size="sm" variant="secondary" onClick={() => onRecordAi(row.cattle_id)}>
                    {t("recordAi")}
                  </Button>
                </AttentionRow>
              )}
            />
          </TabsContent>

          <TabsContent value="pregnancyCheck" className="mt-0 flex flex-1 flex-col">
            <AttentionList
              rows={action?.pregnancy_check_due ?? []}
              emptyLabel={t("emptyPregnancyCheckDue")}
              renderRow={(row: PregnancyCheckDueRow) => (
                <AttentionRow
                  key={row.cattle_id}
                  cow={row}
                  meta={
                    <MetaPill tone="muted">
                      {t("aiOn")} <DateText date={row.ai_date} />
                    </MetaPill>
                  }
                >
                  <Button size="sm" variant="ghost" onClick={() => onReturnToHeat(row.cattle_id)}>
                    {t("returnToHeat")}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onRecordPregnancyCheck(row.cattle_id, row.breeding_event_id)}
                  >
                    {t("recordCheck")}
                  </Button>
                </AttentionRow>
              )}
            />
          </TabsContent>

          <TabsContent value="calving" className="mt-0 flex flex-1 flex-col">
            <AttentionList
              rows={action?.calving_next_7_days ?? []}
              emptyLabel={t("emptyCalvingNext7Days")}
              renderRow={(row: CalvingNext7DaysRow) => {
                const left = row.days_remaining;
                return (
                  <AttentionRow
                    key={row.cattle_id}
                    cow={row}
                    meta={
                      <MetaPill
                        tone={left == null ? "muted" : left < 0 ? "danger" : left <= 2 ? "warning" : "muted"}
                      >
                        {left == null
                          ? "—"
                          : left < 0
                            ? t("daysOverdue", { value: Math.abs(left) })
                            : left === 0
                              ? t("dueToday")
                              : t("daysRemaining", { value: left })}
                      </MetaPill>
                    }
                  >
                    <Button size="sm" variant="secondary" onClick={() => onRecordCalving(row.cattle_id, row.pregnancy_id)}>
                      {t("recordCalving")}
                    </Button>
                  </AttentionRow>
                );
              }}
            />
          </TabsContent>

          <TabsContent value="dryOff" className="mt-0 flex flex-1 flex-col">
            <AttentionList
              rows={action?.dryoff_due_14_days ?? []}
              emptyLabel={t("emptyDryoffDue14Days")}
              renderRow={(row: DryoffDue14DaysRow) => (
                <AttentionRow
                  key={row.cattle_id}
                  cow={row}
                  meta={
                    <MetaPill tone="muted">
                      {t("dryoffTarget")} <DateText date={row.dryoff_target_date} />
                    </MetaPill>
                  }
                >
                  <Button size="sm" variant="secondary" onClick={() => onRecordDryOff(row.cattle_id)}>
                    {t("recordDryOff")}
                  </Button>
                </AttentionRow>
              )}
            />
          </TabsContent>
        </Tabs>
      )}
    </ReproductionCard>
  );
}

function AttentionList<T>({
  rows,
  emptyLabel,
  renderRow,
}: {
  rows: T[];
  emptyLabel: string;
  renderRow: (row: T) => React.ReactNode;
}) {
  const reveal = useIncrementalReveal(rows, ATTENTION_STEP);
  if (rows.length === 0) {
    return <EmptyState icon={CircleCheckBig} title={emptyLabel} className="flex-1 justify-center py-10" />;
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      <ul className="flex flex-col divide-y divide-border/80">{reveal.visible.map(renderRow)}</ul>
      <InfiniteScrollFooter
        hasNextPage={reveal.hasMore}
        isFetchingNextPage={false}
        onLoadMore={reveal.showMore}
        className="mt-auto"
      />
    </div>
  );
}

function AttentionRow({
  cow,
  meta,
  children,
}: {
  cow: { cattle_id: string; name: string | null; tag: string };
  meta: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex min-h-[3.75rem] flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5 transition-colors hover:bg-muted/30 px-2 rounded-lg">
      <ReproductionCowIdentity cattleId={cow.cattle_id} name={cow.name} tag={cow.tag} className="flex-1 min-w-44" />
      <div className="flex items-center gap-2">
        {meta}
        {children}
      </div>
    </li>
  );
}

const PILL_TONES = {
  muted: "bg-muted text-muted-foreground",
  warning: "bg-warning-tint text-warning font-semibold",
  danger: "bg-destructive-tint text-destructive font-semibold",
} as const;

function MetaPill({ tone = "muted", children }: { tone?: keyof typeof PILL_TONES; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs", PILL_TONES[tone])}>
      {children}
    </span>
  );
}
