"use client"; // reason input + mutation

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useSkipTask } from "../hooks/use-health";
import type { HealthTask } from "../types";

/** `POST /health/tasks/:id/skip` (`healthcare.update`) — small reason-prompt, matches
 * `cattle-archive-dialog.tsx`'s "custom Dialog for one extra field" pattern rather than the generic
 * `FormDialog` (no form validation needed, `reason` is optional). Skipping removes the task from
 * every `ScheduledTaskGroup` (`task-grouping.ts` already excludes `SKIPPED` rows). */
export function SkipTaskDialog({
  task,
  onOpenChange,
  onSkipped,
}: {
  task: HealthTask | null;
  onOpenChange: (open: boolean) => void;
  onSkipped?: (taskId: string) => void;
}) {
  const t = useTranslations("health.taskHub.skipDialog");
  const skipTask = useSkipTask();
  const [reason, setReason] = useState("");

  async function handleConfirm() {
    if (!task) return;
    try {
      await skipTask.mutateAsync({ id: task.id, dto: { reason: reason.trim() || undefined } });
      toast.success(t("skippedToast"));
      onSkipped?.(task.id);
      setReason("");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <Sheet open={Boolean(task)} onOpenChange={onOpenChange}>
      {task ? (
        <SheetContent side="right" className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t("title", { name: task.cattle?.name ?? task.cattle?.tagNumber ?? "" })}</SheetTitle>
            <SheetDescription>{t("description")}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="skip-task-reason">{t("reason")}</Label>
            <Input id="skip-task-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <SheetFooter className="border-t border-dashed border-border pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={skipTask.isPending}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={skipTask.isPending}>
              {skipTask.isPending ? "…" : t("confirm")}
            </Button>
          </SheetFooter>
        </SheetContent>
      ) : null}
    </Sheet>
  );
}
