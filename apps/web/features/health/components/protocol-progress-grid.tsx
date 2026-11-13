"use client"; // grid state + dialogs

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCan } from "@/lib/auth/permissions";
import { AnimalLink } from "@/components/shared/animal-link";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { useProtocolTasks } from "../hooks/use-health";
import { buildProtocolGrid, dueTasksOfColumn, groupOfTasks, type GridRow } from "../protocol-grid-model";
import type { ScheduledTaskGroup } from "../task-grouping";
import type { HealthPlanListItem, HealthTask } from "../types";
import { ProtocolGridCell } from "./protocol-grid-cell";
import { RecordBatchDialog } from "./record-batch-dialog";
import { SkipTaskDialog } from "./skip-task-dialog";
import { TaskRescheduleDialog } from "./task-reschedule-dialog";

/**
 * RFE-144 — the protocol sheet's **Progress** tab: every animal on the protocol as a row, every step as a column, each
 * cell the state of that step for that animal (done / skipped / late / today / date). It replaces the old Due now
 * (a tall card per step) and Animals (a roster) tabs, so "what is due for Bhola?" is one glance, and 2 animals or 40
 * read the same way.
 *  - **Due only** keeps just the animals that have something due today or late (all columns stay, for context).
 *  - A column header offers **Record all (n)** for that step's due cells; a cell opens Record / Reschedule / Skip for
 *    that one step (RFE-145). Both need `healthcare.update`; without it the grid is read-only.
 *  - An animal on a sickness case opens that case; any other row opens the animal.
 * Reads up to 500 steps (`useProtocolTasks`) and says so when the protocol has more (RD-117).
 */
export function ProtocolProgressGrid({ plan, onManageCase }: { plan: HealthPlanListItem; onManageCase?: (caseId: string) => void }) {
  const t = useTranslations("health.healthPlan.sheet.progress");
  const can = useCan();
  const canAct = can("healthcare.update");
  const query = useProtocolTasks(plan.id);
  const [dueOnly, setDueOnly] = useState(false);
  const [recording, setRecording] = useState<ScheduledTaskGroup | undefined>(undefined);
  const [rescheduling, setRescheduling] = useState<ScheduledTaskGroup | undefined>(undefined);
  const [skipping, setSkipping] = useState<HealthTask | null>(null);

  const grid = useMemo(() => buildProtocolGrid(query.data?.items ?? [], plan.steps), [query.data, plan.steps]);

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-40 rounded-lg" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }
  if (query.isError) return <ErrorState description={t("error")} onRetry={() => void query.refetch()} />;
  if (grid.rows.length === 0) return <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />;

  const rows: GridRow[] = dueOnly ? grid.rows.filter((row) => row.dueCount > 0) : grid.rows;
  const single = (task: HealthTask) => groupOfTasks([task]);
  const actions = {
    onRecord: (task: HealthTask) => setRecording(single(task)),
    onReschedule: (task: HealthTask) => setRescheduling(single(task)),
    onSkip: (task: HealthTask) => setSkipping(task),
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={dueOnly}
          onClick={() => setDueOnly((v) => !v)}
          className={cn(
            "flex min-h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors",
            dueOnly ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
          )}
        >
          {t("dueOnly")}
        </button>
        <span className="text-xs text-muted-foreground">{t("showing", { shown: rows.length, total: grid.rows.length })}</span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={t("nothingDueTitle")}
          description={t("nothingDueDescription")}
          action={
            <Button type="button" size="sm" variant="outline" onClick={() => setDueOnly(false)}>
              {t("showAll")}
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 min-w-[120px] border-b border-border bg-card px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                  {t("animal")}
                </th>
                {grid.columns.map((column) => {
                  const due = dueTasksOfColumn(grid, column.key);
                  return (
                    <th key={column.key} scope="col" className="min-w-[112px] border-b border-border bg-card px-2 py-2 align-top text-left">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-muted-foreground">{column.dayNumber != null ? t("day", { day: column.dayNumber }) : t("extraStep")}</span>
                        <span className="truncate text-xs font-medium text-foreground" title={column.title}>
                          {column.title}
                        </span>
                        {canAct && due.length > 0 ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 px-2 text-xs"
                            aria-label={t("recordAllLabel", { count: due.length, step: column.title })}
                            onClick={() => setRecording(groupOfTasks(due))}
                          >
                            {t("recordAll", { count: due.length })}
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
              {rows.map((row) => (
                <tr key={row.key}>
                  <th scope="row" className="sticky left-0 z-10 border-b border-border bg-card px-3 py-2 text-left align-middle font-normal">
                    <div className="flex min-w-0 flex-col">
                      {row.healthCaseId && onManageCase ? (
                        <button type="button" className="truncate text-left text-sm font-semibold text-foreground hover:underline" onClick={() => onManageCase(row.healthCaseId!)} title={t("openCase")}>
                          {row.label}
                        </button>
                      ) : (
                        <AnimalLink id={row.cattleId} animalName={row.label} tagNumber={row.tagNumber} className="truncate text-left text-sm font-semibold text-foreground" />
                      )}
                      {row.tagNumber && row.tagNumber !== row.label ? <span className="truncate text-xs text-muted-foreground">{row.tagNumber}</span> : null}
                    </div>
                  </th>
                  {grid.columns.map((column) => {
                    const cell = row.cells[column.key];
                    return (
                      <td key={column.key} className="border-b border-border px-2 py-1.5 align-middle">
                        {cell ? <ProtocolGridCell cell={cell} canAct={canAct} actions={actions} animalLabel={row.label} /> : <span className="block text-center text-xs text-muted-foreground">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {query.data?.truncated ? <p className="text-xs text-warning">{t("truncated", { count: query.data.items.length })}</p> : null}

      <RecordBatchDialog group={recording} onOpenChange={(open) => !open && setRecording(undefined)} />
      <TaskRescheduleDialog group={rescheduling} onOpenChange={(open) => !open && setRescheduling(undefined)} />
      <SkipTaskDialog task={skipping} onOpenChange={(open) => !open && setSkipping(null)} />
    </div>
  );
}
