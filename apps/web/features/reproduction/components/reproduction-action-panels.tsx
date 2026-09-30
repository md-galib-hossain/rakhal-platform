"use client"; // live query + tab / expand state + row action buttons

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CircleCheckBig } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { DateText } from "@/components/shared/date-text";
import { Pagination } from "@/components/shared/pagination";
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

/** Rows per page — keeps a 60-cow "ready for AI" list from pushing the rest of the page a screen
 * and a half down. The dashboard endpoint returns every row, so paging is client-side. 8 by default so
 * the card is tall enough to show a real working set beside its partner; 16 / 24 / 48 are one tap away in the pager, which
 * always shows (like the events feed's) so it is where you expect it even when everything fits one page. */
export const ATTENTION_PAGE_SIZE = 8;
const ATTENTION_PAGE_SIZES = [8, 16, 24, 48] as const;

export interface ReproductionActionPanelsProps {
  onRecordAi: (cattleId: string) => void;
  onRecordPregnancyCheck: (cattleId: string, breedingEventId?: string) => void;
  onReturnToHeat: (breedingEventId: string) => void;
  onRecordCalving: (cattleId: string, pregnancyId?: string) => void;
  onRecordDryOff: (cattleId: string) => void;
}

/** "Cows Needing Action Today" (PRD §9.2) — the dashboard's 5 `action_required` lists as ONE panel
 * with a count-badged tab per list, instead of 5 stacked cards that each repeated the same row
 * layout. The tab strip doubles as the at-a-glance workload summary and opens on the first non-empty
 * list. Rows wrap their actions under the cow on a narrow card (no breakpoints — `flex-wrap` +
 * `basis`), and the tab strip scrolls sideways rather than squashing labels. Dry-off has a real
 * backend route (RD-038, `POST /reproduction/cattle/:id/dry-off`). */
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(ATTENTION_PAGE_SIZE);

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
    setPage(1);
  }
  function changePageSize(size: number) {
    setPageSize(size);
    setPage(1);
  }

  if (dashboard.isLoading) {
    return (
      <ReproductionCard title={t("title")}>
        <Skeleton className="h-11 w-full" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </ReproductionCard>
    );
  }
  if (dashboard.isError) {
    return (
      <ReproductionCard title={t("title")}>
        <ErrorState description={t("error")} onRetry={() => dashboard.refetch()} />
      </ReproductionCard>
    );
  }

  return (
    <ReproductionCard
      title={t("title")}
      description={total > 0 ? t("summary", { count: total }) : undefined}
      className="h-full min-h-[34rem]"
    >
      {total === 0 ? (
        <EmptyState icon={CircleCheckBig} title={t("allClear")} description={t("allClearHint")} className="flex-1 justify-center py-8" />
      ) : (
        <Tabs value={activeTab} onValueChange={selectTab} className="flex flex-1 flex-col gap-3">
          <TabsList
            aria-label={t("title")}
            className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {TAB_ORDER.map((key) => (
              <TabsTrigger key={key} value={key} className="h-9 shrink-0 rounded-lg px-3">
                {t(`tabs.${key}`)}
                <span
                  className={cn(
                    "min-w-5 rounded-full px-1.5 text-center text-xs font-bold leading-5",
                    counts[key] > 0 ? "bg-primary/15 text-primary" : "bg-background/60 text-muted-foreground",
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
              page={page}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={changePageSize}
              emptyLabel={t("emptyReadyForAi")}
              renderRow={(row: ReadyForAiRow) => (
                <AttentionRow
                  key={row.cattle_id}
                  cow={row}
                  meta={<MetaPill>{t("daysOpen", { value: row.days_open ?? 0 })}</MetaPill>}
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
              page={page}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={changePageSize}
              emptyLabel={t("emptyInHeatNow")}
              renderRow={(row: InHeatNowRow) => (
                <AttentionRow
                  key={row.cattle_id}
                  cow={row}
                  meta={
                    <MetaPill>
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
              page={page}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={changePageSize}
              emptyLabel={t("emptyPregnancyCheckDue")}
              renderRow={(row: PregnancyCheckDueRow) => (
                <AttentionRow
                  key={row.cattle_id}
                  cow={row}
                  meta={
                    <MetaPill>
                      {t("aiOn")} <DateText date={row.ai_date} />
                    </MetaPill>
                  }
                >
                  <Button size="sm" variant="ghost" onClick={() => onReturnToHeat(row.breeding_event_id)}>
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
              page={page}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={changePageSize}
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
              page={page}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={changePageSize}
              emptyLabel={t("emptyDryoffDue14Days")}
              renderRow={(row: DryoffDue14DaysRow) => (
                <AttentionRow
                  key={row.cattle_id}
                  cow={row}
                  meta={
                    <MetaPill>
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

/** One tab's rows, `pageSize` per page. The list takes the card's spare height (`flex-1`) and the pager
 * — always shown, with the page-size picker — is pinned to the bottom (`mt-auto`), so the card keeps its
 * shape, and matches its partner, whether the page is full or the last, short one. */
function AttentionList<T>({
  rows,
  page,
  onPageChange,
  pageSize,
  onPageSizeChange,
  emptyLabel,
  renderRow,
}: {
  rows: T[];
  page: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  emptyLabel: string;
  renderRow: (row: T) => React.ReactNode;
}) {
  if (rows.length === 0) {
    return <EmptyState icon={CircleCheckBig} title={emptyLabel} className="flex-1 justify-center py-8" />;
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const shown = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  return (
    <div className="flex flex-1 flex-col gap-3">
      <ul className="flex flex-col divide-y divide-border">{shown.map(renderRow)}</ul>
      <Pagination
        page={safePage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        pageSize={pageSize}
        onPageSizeChange={onPageSizeChange}
        pageSizeOptions={ATTENTION_PAGE_SIZES}
        className="mt-auto"
      />
    </div>
  );
}

/** One cow row. The identity block claims the first `basis-44` (11rem) of the line; whatever doesn't
 * fit beside it — the meta pill and buttons — wraps underneath and right-aligns, so there is no
 * viewport or container breakpoint to tune. */
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
    <li className="flex min-h-[3.75rem] flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
      <ReproductionCowIdentity cattleId={cow.cattle_id} name={cow.name} tag={cow.tag} className="flex-1 basis-44" />
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        {meta}
        {children}
      </div>
    </li>
  );
}

const PILL_TONES = {
  muted: "bg-muted text-muted-foreground",
  warning: "bg-warning-tint text-warning",
  danger: "bg-destructive-tint text-destructive",
} as const;

function MetaPill({ tone = "muted", children }: { tone?: keyof typeof PILL_TONES; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", PILL_TONES[tone])}>
      {children}
    </span>
  );
}
