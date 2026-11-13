"use client"; // grid state + dialogs

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, ChevronDown, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCan } from "@/lib/auth/permissions";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { ApiError } from "@/lib/api/errors";
import { Chip } from "@/components/ui/chip";
import { AnimalLink } from "@/components/shared/animal-link";
import { ProtocolRemoveDialog, type RemoveMode } from "./protocol-remove-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { useCancelAnimalProtocol, useProtocolTaskLoader, useRemoveFromRound, useRoundGrid } from "../hooks/use-health";
import { groupOfTasks, isDueState, type GridCell } from "../protocol-grid-model";
import type { ScheduledTaskGroup } from "../task-grouping";
import type { HealthTask, ProtocolRound, RoundGridCell, RoundGridRow } from "../types";
import { ProtocolGridCell } from "./protocol-grid-cell";
import { RecordBatchDialog } from "./record-batch-dialog";
import { SkipTaskDialog } from "./skip-task-dialog";
import { TaskRescheduleDialog } from "./task-reschedule-dialog";

/** The rounds API's cell, in the shape `ProtocolGridCell` draws: only what it shows (id, title, status, dates). The full
 * step (medicine, dose, animal…) is loaded when an action needs it — see `useProtocolTaskLoader`. */
function toGridCell(cell: RoundGridCell): GridCell {
  const task = { id: cell.taskId, title: cell.title, status: cell.status, dueDateTime: cell.dueDate, completedAt: cell.doneAt } as HealthTask;
  return { task, state: cell.state, days: cell.days };
}

/**
 * The round sheet's **Progress** tab (RFE-147, EPIC_PROTOCOL_ROUNDS §5.2): the animal × step grid of ONE round, from
 * `GET /health/rounds/:key/grid`. Same look and actions as the protocol-wide grid (RFE-144/145), but it is scoped to the
 * round, pages by animal ("Show more animals" — no 100-animal ceiling), and the server decides each cell's state on the
 * farm's calendar day (including `inactive`: the animal left the herd or the run stopped).
 *  - Record / Reschedule / Skip on a cell and **Record all** on a column need `healthcare.update`.
 *  - The dialogs need the full step, which the grid does not carry, so it is read from the protocol's steps on demand.
 */
export function RoundProgressGrid({
  round,
  onManageCase,
  layout = "auto",
  dueOnly: dueOnlyProp,
}: {
  round: ProtocolRound;
  onManageCase?: (caseId: string) => void;
  /** `auto` = the table on a wide screen and cards on a phone; `cards` = always one card per animal (the Applied list). */
  layout?: "auto" | "cards";
  /** Controlled "due only" (the Applied list's status filter owns it): the switch is hidden. Left out = the grid's own switch. */
  dueOnly?: boolean;
}) {
  const t = useTranslations("health.healthPlan.sheet.progress");
  const tProto = useTranslations("health.cattleProtocols");
  const can = useCan();
  const canAct = can("healthcare.update");
  // RFE-149: on a phone the grid is a list of animal cards, and "Due only" starts on (a farmer in the shed wants what is
  // left to do, not 40 done cells). The user's own choice wins from the first tap.
  const isPhone = useMediaQuery("(max-width: 639px)");
  const [dueChoice, setDueChoice] = useState<boolean | null>(null);
  const controlled = dueOnlyProp !== undefined;
  const dueOnly = controlled ? dueOnlyProp : (dueChoice ?? isPhone);
  const cards = layout === "cards" || isPhone;
  const [openRows, setOpenRows] = useState<ReadonlySet<string>>(new Set());
  const query = useRoundGrid(round.roundKey, dueOnly);
  const loadTasks = useProtocolTaskLoader(round.healthPlan.id);
  const [recording, setRecording] = useState<ScheduledTaskGroup | undefined>(undefined);
  const [rescheduling, setRescheduling] = useState<ScheduledTaskGroup | undefined>(undefined);
  const [skipping, setSkipping] = useState<HealthTask | null>(null);
  const removeFromRound = useRemoveFromRound();
  const cancelAnimal = useCancelAnimalProtocol();
  const tUndo = useTranslations("health.protocolUndo");
  const [removing, setRemoving] = useState<RoundGridRow | null>(null);

  const pages = useMemo(() => query.data?.pages ?? [], [query.data]);
  const columns = pages[0]?.data.columns ?? [];
  const rows = useMemo(() => pages.flatMap((page) => page.data.rows), [pages]);

  /** The full steps for these ids, or an error toast when they are not among the protocol's loaded steps. */
  async function resolve(ids: string[]): Promise<HealthTask[]> {
    try {
      const found = await loadTasks(ids);
      if (found.length > 0) return found;
    } catch {
      /* falls through to the toast */
    }
    toast.error(t("taskNotLoaded"));
    return [];
  }
  const actions = {
    onRecord: async (task: HealthTask) => {
      const found = await resolve([task.id]);
      if (found.length) setRecording(groupOfTasks(found));
    },
    onReschedule: async (task: HealthTask) => {
      const found = await resolve([task.id]);
      if (found.length) setRescheduling(groupOfTasks(found));
    },
    onSkip: async (task: HealthTask) => {
      const [found] = await resolve([task.id]);
      if (found) setSkipping(found);
    },
  };
  /** RFE-148 — take this animal off the round's protocol: its open steps are skipped and kept in history, and it leaves the
   * round (a sickness case stays open for manual care). Same server action as the cow's own Protocols section. */
  async function confirmRemove(mode: RemoveMode, reason: string | undefined) {
    if (!removing) return;
    const target = removing.healthCaseId ? { healthCaseId: removing.healthCaseId } : { planEnrollmentId: removing.planEnrollmentId ?? undefined };
    try {
      if (mode === "cancel") {
        const result = await cancelAnimal.mutateAsync({ cattleId: removing.cattle.id, dto: { ...target, reason } });
        toast.success(tUndo("cancelledToast", { doses: result.dosesReversed }));
      } else {
        await removeFromRound.mutateAsync({ cattleId: removing.cattle.id, dto: { ...target, reason } });
        toast.success(tProto("removedToast"));
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tProto("genericError"));
      throw err;
    }
  }
  async function recordColumn(columnKey: string) {
    const ids = rows.flatMap((row) => {
      const cell = row.cells[columnKey];
      return cell && isDueState(cell.state) ? [cell.taskId] : [];
    });
    const found = await resolve(ids);
    if (found.length) setRecording(groupOfTasks(found));
  }

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-40 rounded-lg" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }
  if (query.isError) return <ErrorState description={t("error")} onRetry={() => void query.refetch()} />;
  if (rows.length === 0 && !dueOnly) return <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />;

  return (
    <div className="flex flex-col gap-3">
      <div className={cn("flex flex-wrap items-center gap-2", controlled ? "justify-end" : "justify-between")}>
        {controlled ? null : (
          <button
            type="button"
            role="switch"
            aria-checked={dueOnly}
            onClick={() => setDueChoice(!dueOnly)}
            className={cn(
              "flex min-h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors",
              dueOnly ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            )}
          >
            {t("dueOnly")}
          </button>
        )}
        <span className="text-xs text-muted-foreground">{t("showing", { shown: rows.length, total: round.animalCount })}</span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={t("nothingDueTitle")}
          description={t("nothingDueDescription")}
          action={
            controlled ? undefined : (
              <Button type="button" size="sm" variant="outline" onClick={() => setDueChoice(false)}>
                {t("showAll")}
              </Button>
            )
          }
        />
      ) : cards ? (
        <>
        {canAct ? (
          <div className="flex flex-wrap gap-2">
            {columns.map((column) => {
              const dueCount = rows.filter((row) => {
                const cell = row.cells[column.key];
                return cell && isDueState(cell.state);
              }).length;
              return dueCount > 0 ? (
                <Button
                  key={column.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1 px-3 text-xs"
                  aria-label={t("recordAllLabel", { count: dueCount, step: column.title })}
                  onClick={() => void recordColumn(column.key)}
                >
                  {t("recordAllStep", { count: dueCount, step: column.title })}
                  <ArrowRight className="size-3.5" aria-hidden />
                </Button>
              ) : null;
            })}
          </div>
        ) : null}
        <ul className="flex flex-col gap-2">
          {rows.map((row) => {
            const label = row.cattle.name ?? row.cattle.tagNumber;
            const isOpen = openRows.has(row.runKey);
            const cells = columns.flatMap((column) => (row.cells[column.key] ? [row.cells[column.key]] : []));
            const done = cells.filter((cell) => cell.state === "done").length;
            const dueToday = row.dueCount - row.overdueCount;
            // The one step to act on next: first open step in protocol order. Its cell button is the same menu as the grid's.
            const nextColumn = columns.find((column) => {
              const state = row.cells[column.key]?.state;
              return state === "overdue" || state === "today" || state === "upcoming";
            });
            const nextCell = nextColumn ? row.cells[nextColumn.key] : undefined;
            const inactive = cells.some((cell) => cell.state === "inactive");
            return (
              <li key={row.runKey} className="rounded-xl border border-border bg-card">
                <div className="flex items-center gap-1 p-2 pl-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    {row.healthCaseId && onManageCase ? (
                      <button type="button" className="min-h-6 truncate text-left text-sm font-semibold text-foreground hover:underline" onClick={() => onManageCase(row.healthCaseId!)} title={t("openCase")}>
                        {label}
                      </button>
                    ) : (
                      <AnimalLink id={row.cattle.id} animalName={label} tagNumber={row.cattle.tagNumber} className="truncate text-left text-sm font-semibold text-foreground" />
                    )}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {row.overdueCount > 0 ? <Chip variant="destructive">{t("phone.late", { count: row.overdueCount })}</Chip> : null}
                      {dueToday > 0 ? <Chip variant="warning">{t("phone.due", { count: dueToday })}</Chip> : null}
                      <span className="text-xs text-muted-foreground">{t("phone.doneOf", { done, total: cells.length })}</span>
                    </div>
                  </div>
                  {canAct ? (
                    <button
                      type="button"
                      aria-label={t("removeAria", { animal: label })}
                      className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => setRemoving(row)}
                    >
                      <UserMinus className="size-4" aria-hidden />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-label={t(isOpen ? "phone.collapse" : "phone.expand", { animal: label })}
                    className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() =>
                      setOpenRows((prev) => {
                        const next = new Set(prev);
                        if (!next.delete(row.runKey)) next.add(row.runKey);
                        return next;
                      })
                    }
                  >
                    <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} aria-hidden />
                  </button>
                </div>
                {!isOpen ? (
                  <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2">
                    {nextColumn && nextCell ? (
                      <>
                        <span className="flex min-w-0 flex-col">
                          <span className="text-xs text-muted-foreground">{t("phone.next")}</span>
                          <span className="truncate text-sm font-medium text-foreground">{nextColumn.title}</span>
                        </span>
                        <span className="w-36 shrink-0">
                          <ProtocolGridCell cell={toGridCell(nextCell)} canAct={canAct} actions={actions} animalLabel={label} />
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">{inactive ? t("cell.inactive") : t("phone.allDone")}</span>
                    )}
                  </div>
                ) : null}
                {isOpen ? (
                  <ul className="flex flex-col gap-2 border-t border-border p-3">
                    {columns.map((column) => {
                      const cell = row.cells[column.key];
                      return (
                        <li key={column.key} className="flex items-center justify-between gap-3">
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-medium text-foreground">{column.title}</span>
                            <span className="text-xs text-muted-foreground">{column.dayNumber != null ? t("day", { day: column.dayNumber }) : t("extraStep")}</span>
                          </span>
                          <span className="w-32 shrink-0">
                            {cell ? <ProtocolGridCell cell={toGridCell(cell)} canAct={canAct} actions={actions} animalLabel={label} /> : <span className="block text-center text-xs text-muted-foreground">—</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
        </>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 min-w-[120px] border-b border-border bg-card px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                  {t("animal")}
                </th>
                {columns.map((column) => {
                  const dueCount = rows.filter((row) => {
                    const cell = row.cells[column.key];
                    return cell && isDueState(cell.state);
                  }).length;
                  return (
                    <th key={column.key} scope="col" className="min-w-[112px] border-b border-border bg-card px-2 py-2 align-top text-left">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-muted-foreground">{column.dayNumber != null ? t("day", { day: column.dayNumber }) : t("extraStep")}</span>
                        <span className="truncate text-xs font-medium text-foreground" title={column.title}>
                          {column.title}
                        </span>
                        {canAct && dueCount > 0 ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 px-2 text-xs"
                            aria-label={t("recordAllLabel", { count: dueCount, step: column.title })}
                            onClick={() => void recordColumn(column.key)}
                          >
                            {t("recordAll", { count: dueCount })}
                            <ArrowRight className="size-3.5" aria-hidden />
                          </Button>
                        ) : null}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const label = row.cattle.name ?? row.cattle.tagNumber;
                return (
                  <tr key={row.runKey}>
                    <th scope="row" className="sticky left-0 z-10 border-b border-border bg-card px-3 py-2 text-left align-middle font-normal">
                      <div className="flex min-w-0 items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-col">
                        {row.healthCaseId && onManageCase ? (
                          <button type="button" className="truncate text-left text-sm font-semibold text-foreground hover:underline" onClick={() => onManageCase(row.healthCaseId!)} title={t("openCase")}>
                            {label}
                          </button>
                        ) : (
                          <AnimalLink id={row.cattle.id} animalName={label} tagNumber={row.cattle.tagNumber} className="truncate text-left text-sm font-semibold text-foreground" />
                        )}
                        {row.cattle.name && row.cattle.tagNumber !== label ? <span className="truncate text-xs text-muted-foreground">{row.cattle.tagNumber}</span> : null}
                      </div>
                      {canAct ? (
                        <button
                          type="button"
                          aria-label={t("removeAria", { animal: label })}
                          className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => setRemoving(row)}
                        >
                          <UserMinus className="size-4" aria-hidden />
                        </button>
                      ) : null}
                      </div>
                    </th>
                    {columns.map((column) => {
                      const cell = row.cells[column.key];
                      return (
                        <td key={column.key} className="border-b border-border px-2 py-1.5 align-middle">
                          {cell ? <ProtocolGridCell cell={toGridCell(cell)} canAct={canAct} actions={actions} animalLabel={label} /> : <span className="block text-center text-xs text-muted-foreground">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {query.hasNextPage ? (
        <Button type="button" variant="outline" className="self-center" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
          {t("loadMore")}
        </Button>
      ) : null}

      <RecordBatchDialog group={recording} onOpenChange={(open) => !open && setRecording(undefined)} />
      <TaskRescheduleDialog group={rescheduling} onOpenChange={(open) => !open && setRescheduling(undefined)} />
      <SkipTaskDialog task={skipping} onOpenChange={(open) => !open && setSkipping(null)} />
      <ProtocolRemoveDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        protocolName={round.healthPlan.name}
        hasCase={Boolean(removing?.healthCaseId)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
