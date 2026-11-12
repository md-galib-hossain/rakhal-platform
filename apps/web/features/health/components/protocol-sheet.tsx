"use client"; // tab + dialog state

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { format } from "date-fns";
import { Can } from "@/lib/auth/permissions";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { useHealthPlan, useHealthTasks } from "../hooks/use-health";
import { groupScheduledTasks, type ScheduledTaskGroup } from "../task-grouping";
import type { HealthPlanListItem, HealthTaskFilters, HealthTaskStatus, ProtocolRound } from "../types";
import { farmDay } from "../round-model";
import { RoundAnimalsDialog } from "./round-animals-dialog";
import { RoundProgressGrid } from "./round-progress-grid";
import { ProtocolLiveState } from "./protocol-live-state";
import { ProtocolResultStats } from "./protocol-result-stats";
import { ProtocolProgressGrid } from "./protocol-progress-grid";
import { ScheduledTaskCard } from "./scheduled-task-card";
import { TaskRescheduleDialog } from "./task-reschedule-dialog";
import { RecordBatchDialog } from "./record-batch-dialog";

/** What the sheet is open on: one protocol, or the steps that belong to none (legacy rows; none are created today). */
export type ProtocolSheetTarget = { kind: "plan"; plan: HealthPlanListItem } | { kind: "round"; round: ProtocolRound } | { kind: "loose" };

export const OPEN_STEP_STATUSES: HealthTaskStatus[] = ["PENDING", "RESCHEDULED", "OVERDUE"];

const SHEET_TABS = ["progress", "steps", "results"] as const;
type SheetTab = (typeof SHEET_TABS)[number];

/**
 * RFE-143 / EPIC D12 — the per-protocol sheet, opened from a protocol card. This is where the old "Care steps" (Schedule)
 * tab went: the work of one protocol in one place.
 *  - **Progress** (RFE-144, EPIC_PROTOCOL_ROUNDS) — every animal on the protocol × every step as a grid; one tap on a cell
 *    records / reschedules / skips that step, a column header records everything due (`ProtocolProgressGrid`). It replaces
 *    the old *Due now* (a tall card per step) and *Animals* (roster) tabs.
 *  - **Steps** — the sequence the protocol is made of, with an Apply button.
 *  - **Results** — recovery / coverage (`ProtocolResultStats`).
 * The "Not part of a protocol" target has no grid (no protocol, no step columns): it lists its due steps as step cards,
 * so they can still be recorded or moved.
 * The plan shown in the header is the one from the live list, so the counts follow every action taken in the sheet.
 */
export function ProtocolSheet({
  target,
  onOpenChange,
  onApply,
  onManageCase,
}: {
  target: ProtocolSheetTarget | null;
  onOpenChange: (open: boolean) => void;
  onApply: (plan: HealthPlanListItem) => void;
  onManageCase?: (caseId: string) => void;
}) {
  const manageCase = onManageCase
    ? (caseId: string) => {
        onOpenChange(false); // two stacked sheets would fight for focus - the case sheet replaces this one
        onManageCase(caseId);
      }
    : undefined;
  return (
    <Sheet open={target !== null} onOpenChange={onOpenChange}>
      <SheetContent className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5 sm:max-w-[640px]">
        {target ? (
          target.kind === "round" ? (
            <RoundSheetBody key={target.round.roundKey} round={target.round} onApply={onApply} onManageCase={manageCase} />
          ) : (
            <ProtocolSheetBody key={target.kind === "plan" ? target.plan.id : "loose"} target={target} onApply={onApply} onManageCase={manageCase} />
          )
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ProtocolSheetBody({
  target,
  onApply,
  onManageCase,
}: {
  target: Exclude<ProtocolSheetTarget, { kind: "round" }>;
  onApply: (plan: HealthPlanListItem) => void;
  onManageCase?: (caseId: string) => void;
}) {
  const t = useTranslations("health.healthPlan.sheet");
  const tCard = useTranslations("health.healthPlan.card");
  const tCondition = useTranslations("health.reportSickness");
  const [tab, setTab] = useState<SheetTab>("progress");
  const plan = target.kind === "plan" ? target.plan : null;
  const archived = Boolean(plan?.deletedAt);

  return (
    <>
      <SheetHeader className="gap-2 pr-8">
        <SheetTitle className="text-xl font-bold [overflow-wrap:anywhere]">{plan ? plan.name : t("loose.title")}</SheetTitle>
        {plan ? (
          <>
            <SheetDescription className="sr-only">{t("description")}</SheetDescription>
            <div className="flex flex-wrap items-center gap-1.5">
              {archived ? <Chip variant="destructive">{tCard("deleted")}</Chip> : null}
              {plan.condition ? <Chip variant="warning">{tCondition(`conditionValue.${plan.condition}`)}</Chip> : null}
              <span className="text-sm text-muted-foreground">
                {tCard("actionSteps", { count: plan.totalActionSteps })} · {tCard("cycleLength", { count: plan.cycleLengthDays ?? 0 })}
              </span>
            </div>
            <ProtocolLiveState stats={plan.stats} />
            {archived ? <p className="rounded-lg bg-destructive-tint px-3 py-2 text-xs text-destructive">{tCard("deletedHint")}</p> : null}
          </>
        ) : (
          <SheetDescription>{t("loose.description")}</SheetDescription>
        )}
      </SheetHeader>

      {plan ? (
        <Tabs value={tab} onValueChange={(v) => setTab(v as SheetTab)} className="mt-4 flex min-h-0 flex-1 flex-col">
          <TabsList className="w-full justify-start overflow-x-auto">
            {SHEET_TABS.map((key) => (
              <TabsTrigger key={key} value={key} className="flex-1 sm:flex-none">
                {t(`tabs.${key}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <TabsContent value="progress">
              <ProtocolProgressGrid plan={plan} onManageCase={onManageCase} />
            </TabsContent>
            <TabsContent value="steps">
              <StepSequence plan={plan} />
            </TabsContent>
            <TabsContent value="results">
              <div className="flex flex-col gap-3">
                <ProtocolResultStats stats={plan.stats} />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      ) : (
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
          <DueNow plan={null} />
        </div>
      )}

      {plan ? (
        <div className="mt-4 flex shrink-0 items-center gap-2 border-t border-border pt-4">
          <Can I="healthcare.update">
            <Button type="button" className="h-11 flex-1" disabled={archived} onClick={() => onApply(plan)}>
              {tCard("apply")}
            </Button>
          </Can>
        </div>
      ) : null}
    </>
  );
}

/** Today as the farm's calendar day, taken from the browser clock like every other day key in this feature (a farm in
 * Bangladesh is on the browser's day; the server-side counts on the card use the farm timezone). */
function todayKey(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/** `YYYY-MM-DD` (a farm calendar day) as a local `Date` at noon, so formatting it never slips a day across zones. */
function dayOf(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

/** The *Due now* list — steps of one protocol (or of none) that are open and due up to today, as step cards. */
function DueNow({ plan }: { plan: HealthPlanListItem | null }) {
  const t = useTranslations("health.healthPlan.sheet.due");
  const formatter = useFormatter();
  const filters: HealthTaskFilters = {
    ...(plan ? { healthPlanId: plan.id } : { noPlan: true }),
    statuses: OPEN_STEP_STATUSES,
    dueTo: todayKey(),
    sortBy: "due",
    sortOrder: "asc",
  };
  const query = useHealthTasks(filters);
  const [rescheduling, setRescheduling] = useState<ScheduledTaskGroup | undefined>(undefined);
  const [recording, setRecording] = useState<ScheduledTaskGroup | undefined>(undefined);

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-[300px] w-full rounded-2xl" />
        ))}
      </div>
    );
  }
  if (query.isError) return <ErrorState description={t("error")} onRetry={() => void query.refetch()} />;

  const groups = groupScheduledTasks(query.data?.items ?? []);

  return (
    <div className="flex flex-col gap-3">
      {groups.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={plan && plan.stats.inProgress === 0 ? t("emptyNoAnimals") : plan?.stats.nextDueDate ? t("emptyNext", { date: formatter.dateTime(dayOf(plan.stats.nextDueDate), { day: "numeric", month: "short" }) }) : t("emptyDescription")}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <ScheduledTaskCard key={group.key} group={group} onReschedule={setRescheduling} onRecord={setRecording} />
          ))}
        </div>
      )}
      {query.data?.meta.hasNextPage ? <p className="text-xs text-warning">{t("truncated")}</p> : null}

      <TaskRescheduleDialog group={rescheduling} onOpenChange={(open) => !open && setRescheduling(undefined)} />
      <RecordBatchDialog group={recording} onOpenChange={(open) => !open && setRecording(undefined)} />
    </div>
  );
}

/** The protocol's day-by-day sequence (it used to be a collapsed block on the card). */
function StepSequence({ plan }: { plan: HealthPlanListItem }) {
  const t = useTranslations("health.healthPlan");
  if (plan.steps.length === 0) {
    return <EmptyState title={t("sheet.steps.emptyTitle")} description={t("sheet.steps.emptyDescription")} />;
  }
  return (
    <ol className="flex flex-col gap-3">
      {plan.steps.map((step) => (
        <li key={step.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 text-sm">
          <span className="w-12 shrink-0 text-xs font-semibold text-muted-foreground">{t("card.day", { day: step.dayNumber })}</span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-medium text-foreground [overflow-wrap:anywhere]">{step.title}</span>
            {step.instruction ? <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{step.instruction}</span> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * RFE-147 — the sheet of ONE round (opened from a Running card): the round's header (protocol, day, animals, what is due),
 * then **Progress** (this round's animal × step grid from `GET /health/rounds/:key/grid`, `RoundProgressGrid`), **Steps**
 * and **Results** — the latter two are the protocol's own, read with `useHealthPlan` (an archived protocol too). Two
 * rounds of the same protocol are two different sheets. Apply starts a new round of this protocol.
 */
function RoundSheetBody({ round, onApply, onManageCase }: { round: ProtocolRound; onApply: (plan: HealthPlanListItem) => void; onManageCase?: (caseId: string) => void }) {
  const t = useTranslations("health.healthPlan.sheet");
  const tRound = useTranslations("health.healthPlan.sheet.round");
  const tRounds = useTranslations("health.healthPlan.rounds");
  const tCard = useTranslations("health.healthPlan.card");
  const formatter = useFormatter();
  const [tab, setTab] = useState<SheetTab>("progress");
  const [addOpen, setAddOpen] = useState(false);
  const planQuery = useHealthPlan(round.healthPlan.id);
  const plan = planQuery.data;
  const archived = Boolean(round.healthPlan.deletedAt);
  const finished = round.status === "FINISHED";
  const day = (ymd: string) => formatter.dateTime(farmDay(ymd), { day: "numeric", month: "short" });

  return (
    <>
      <SheetHeader className="gap-2 pr-8">
        <SheetTitle className="text-xl font-bold [overflow-wrap:anywhere]">{round.healthPlan.name}</SheetTitle>
        <SheetDescription className="sr-only">{t("description")}</SheetDescription>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip variant="muted">{tRound("roundOf", { date: day(round.startDate) })}</Chip>
          {finished ? <Chip variant="muted">{tRound("finished")}</Chip> : null}
          {archived ? <Chip variant="destructive">{tCard("deleted")}</Chip> : null}
          <span className="text-sm text-muted-foreground">
            {tRounds("animals", { count: round.animalCount })} · {tRounds("stepsDone", { done: round.stepsDone, total: round.stepsTotal })}
          </span>
        </div>
        {!finished ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {round.stepsOverdue > 0 ? <Chip variant="destructive">{tRounds("overdue", { count: round.stepsOverdue })}</Chip> : null}
            {round.stepsDueToday > 0 ? <Chip variant="warning">{tRounds("dueToday", { count: round.stepsDueToday })}</Chip> : null}
            {round.stepsOverdue === 0 && round.stepsDueToday === 0 ? (
              <span className="text-xs text-muted-foreground">{round.nextDueDate ? tRounds("next", { date: day(round.nextDueDate) }) : tRounds("nothingDue")}</span>
            ) : null}
          </div>
        ) : null}
        {archived ? <p className="rounded-lg bg-destructive-tint px-3 py-2 text-xs text-destructive">{tCard("deletedHint")}</p> : null}
      </SheetHeader>

      <Tabs value={tab} onValueChange={(v) => setTab(v as SheetTab)} className="mt-4 flex min-h-0 flex-1 flex-col">
        <TabsList className="w-full justify-start overflow-x-auto">
          {SHEET_TABS.map((key) => (
            <TabsTrigger key={key} value={key} className="flex-1 sm:flex-none">
              {t(`tabs.${key}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <TabsContent value="progress">
            <RoundProgressGrid round={round} onManageCase={onManageCase} />
          </TabsContent>
          <TabsContent value="steps">
            {plan ? <StepSequence plan={plan} /> : planQuery.isError ? <ErrorState description={tRound("planError")} onRetry={() => void planQuery.refetch()} /> : <Skeleton className="h-32 w-full rounded-xl" />}
          </TabsContent>
          <TabsContent value="results">
            {plan ? (
              <div className="flex flex-col gap-3">
                <ProtocolResultStats stats={plan.stats} />
              </div>
            ) : planQuery.isError ? (
              <ErrorState description={tRound("planError")} onRetry={() => void planQuery.refetch()} />
            ) : (
              <Skeleton className="h-32 w-full rounded-xl" />
            )}
          </TabsContent>
        </div>
      </Tabs>

      <div className="mt-4 flex shrink-0 items-center gap-2 border-t border-border pt-4">
        <Can I="healthcare.update">
          <Button type="button" variant="outline" className="h-11 flex-1" disabled={archived} onClick={() => setAddOpen(true)}>
            {tRound("addAnimals")}
          </Button>
          <Button type="button" className="h-11 flex-1" disabled={archived || !plan} onClick={() => plan && onApply(plan)}>
            {tCard("apply")}
          </Button>
        </Can>
      </div>
      <RoundAnimalsDialog round={round} open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}
