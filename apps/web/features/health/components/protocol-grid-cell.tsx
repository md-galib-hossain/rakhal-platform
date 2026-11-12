"use client"; // formatter + popover

import { useFormatter, useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GridCell } from "../protocol-grid-model";
import { CellActionsPopover, type CellActions } from "./cell-actions-popover";

const STATE_STYLE: Record<GridCell["state"], string> = {
  done: "border-success/40 bg-success-tint text-success",
  skipped: "border-border bg-muted text-muted-foreground",
  inactive: "border-dashed border-border bg-muted/50 text-muted-foreground",
  overdue: "border-destructive/40 bg-destructive-tint text-destructive font-semibold",
  today: "border-warning/50 bg-warning-tint text-warning font-semibold",
  upcoming: "border-border bg-card text-muted-foreground",
};

/**
 * One step of one animal in the Progress grid (RFE-144): its state at a glance — done with the day it was done,
 * skipped, "N days late" (red), "Today" (amber), or the date it is due. With `canAct` an open cell is a button that
 * opens `CellActionsPopover` (RFE-145); a finished or skipped cell, and every cell for a user without
 * `healthcare.update`, is plain text.
 */
export function ProtocolGridCell({ cell, canAct, actions, animalLabel }: { cell: GridCell; canAct: boolean; actions: CellActions; animalLabel: string }) {
  const t = useTranslations("health.healthPlan.sheet.progress.cell");
  const formatter = useFormatter();
  const day = (iso: string) => formatter.dateTime(new Date(iso), { day: "numeric", month: "short" });
  const { state, days, task } = cell;

  const label =
    state === "done"
      ? t("done", { date: day(task.completedAt ?? task.dueDateTime) })
      : state === "skipped"
        ? t("skipped")
        : state === "inactive"
          ? t("inactive")
          : state === "overdue"
          ? t("late", { days: Math.abs(days) })
          : state === "today"
            ? t("today")
            : day(task.dueDateTime);

  const body = (
    <>
      {state === "done" ? <Check className="size-3.5 shrink-0" aria-hidden /> : null}
      <span className="truncate">{label}</span>
    </>
  );
  const className = cn("flex min-h-11 w-full min-w-[96px] items-center justify-center gap-1 rounded-lg border px-2 text-xs", STATE_STYLE[state]);

  if (!canAct || state === "done" || state === "skipped" || state === "inactive") {
    return <div className={className}>{body}</div>;
  }
  return (
    <CellActionsPopover task={task} canRecord={state === "overdue" || state === "today"} actions={actions}>
      <button
        type="button"
        className={cn(className, "transition-colors hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring")}
        aria-label={t("open", { animal: animalLabel, step: task.title, state: label })}
      >
        {body}
      </button>
    </CellActionsPopover>
  );
}
