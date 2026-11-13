"use client"; // popover open state + action callbacks

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, CalendarDays, SkipForward } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@rakhal/ui/ui/popover";
import { Button } from "@rakhal/ui/ui/button";
import type { HealthTask } from "../types";

export interface CellActions {
  onRecord: (task: HealthTask) => void;
  onReschedule: (task: HealthTask) => void;
  onSkip: (task: HealthTask) => void;
}

/**
 * RFE-145 — what you can do to ONE step of ONE animal, from its grid cell: Record (only once it is due — future steps
 * are moved or skipped, not recorded early, same rule as the old step card), Reschedule, Skip. Each opens the dialog the
 * old cards already used, scoped to this single task. `children` is the cell button.
 */
export function CellActionsPopover({
  task,
  canRecord,
  actions,
  children,
}: {
  task: HealthTask;
  /** Due today or late. */
  canRecord: boolean;
  actions: CellActions;
  children: React.ReactNode;
}) {
  const t = useTranslations("health.healthPlan.sheet.progress.menu");
  const [open, setOpen] = useState(false);
  const run = (fn: (task: HealthTask) => void) => () => {
    setOpen(false);
    fn(task);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="flex w-48 flex-col gap-1 p-1.5">
        {canRecord ? (
          <Button type="button" variant="ghost" size="sm" className="justify-between" onClick={run(actions.onRecord)}>
            {t("record")}
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        ) : null}
        <Button type="button" variant="ghost" size="sm" className="justify-between" onClick={run(actions.onReschedule)}>
          {t("reschedule")}
          <CalendarDays className="size-4" aria-hidden />
        </Button>
        <Button type="button" variant="ghost" size="sm" className="justify-between text-destructive" onClick={run(actions.onSkip)}>
          {t("skip")}
          <SkipForward className="size-4" aria-hidden />
        </Button>
      </PopoverContent>
    </Popover>
  );
}
