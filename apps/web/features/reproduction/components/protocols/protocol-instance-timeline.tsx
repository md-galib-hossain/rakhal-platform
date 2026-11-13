"use client"; // live query + sheet state

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRightToLine, Check, Circle, AlertTriangle, X, Clock } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@rakhal/ui/ui/sheet";
import { Button } from "@rakhal/ui/ui/button";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { Timeline, type TimelineItem } from "@rakhal/ui/ui/timeline";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { ApiError } from "@/lib/api/errors";
import { useCan } from "@/lib/auth/permissions";
import { qk } from "@/lib/query/keys";
import { tasksApi } from "@/features/tasks/api";
import { useCompleteTask, useReopenTask } from "@/features/tasks/hooks/use-tasks";
import type { Task } from "@/features/tasks/types";
import { useProtocol } from "../../hooks/use-reproduction";
import type { ProtocolInstance, ProtocolStep } from "../../types";
import { RecordAiDialog, RecordOutcomeDialog } from "./protocol-instance-actions";

const PROTOCOL_INSTANCE_SOURCE = "REPRO_PROTOCOL_INSTANCE";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

interface StepRow {
  step: ProtocolStep;
  dueDate: Date;
  task: Task | null;
}

/** Zips a protocol's step definitions to the Task-Hub tasks created for one instance
 * (`repro-protocol.service.ts#apply` creates one task per step, `sourceEventId` = instance id).
 * Matched by expected due-date (same `addDays(start, dayNumber)` formula the backend used to create
 * them) rather than array order/index, since a task can be independently rescheduled by
 * `rescheduleBySourceEvent` and drift from creation order. */
function zipStepsToTasks(steps: ProtocolStep[], tasks: Task[], startDate: Date): StepRow[] {
  const remaining = [...tasks];
  return steps.map((step) => {
    const dueDate = addDays(startDate, step.day_number);
    const matchIndex = remaining.findIndex((t) => sameDay(new Date(t.dueAt), dueDate));
    const task = matchIndex >= 0 ? remaining.splice(matchIndex, 1)[0] : null;
    return { step, dueDate, task };
  });
}

function rowTone(row: StepRow): TimelineItem["tone"] {
  if (!row.task) return "muted";
  if (row.task.status === "COMPLETED") return "success";
  if (row.task.status === "CANCELLED") return "muted";
  if (row.task.displayStatus === "overdue") return "warning";
  return "info";
}

function rowIcon(row: StepRow) {
  if (!row.task) return <Clock className="size-3.5" aria-hidden />;
  if (row.task.status === "COMPLETED") return <Check className="size-3.5" aria-hidden />;
  if (row.task.status === "CANCELLED") return <X className="size-3.5" aria-hidden />;
  if (row.task.displayStatus === "overdue") return <AlertTriangle className="size-3.5" aria-hidden />;
  return <Circle className="size-3.5" aria-hidden />;
}

function useProtocolInstanceTasks(cattleId?: string) {
  return useQuery({
    queryKey: qk.tasks.list({ cattleId, category: "BREEDING" }),
    queryFn: () => tasksApi.list({ cattleId, category: "BREEDING" }, undefined, 100),
    enabled: Boolean(cattleId),
    select: (page) => page.items,
    staleTime: 30_000,
  });
}

function TimelineBody({ instance }: { instance: ProtocolInstance }) {
  const t = useTranslations("reproduction.protocols.timeline");
  const locale = useLocale() as Locale;
  const can = useCan();
  const canUpdate = can("reproduction.update");
  const [aiOpen, setAiOpen] = useState(false);
  const [outcomeOpen, setOutcomeOpen] = useState(false);

  const protocol = useProtocol(instance.protocol_id);
  const tasks = useProtocolInstanceTasks(instance.cattle_id);
  const completeTask = useCompleteTask();
  const reopenTask = useReopenTask();

  const rows = useMemo(() => {
    if (!protocol.data || !tasks.data) return [];
    const instanceTasks = tasks.data.filter(
      (task) => task.sourceEventType === PROTOCOL_INSTANCE_SOURCE && task.sourceEventId === instance.id,
    );
    return zipStepsToTasks(protocol.data.steps, instanceTasks, new Date(instance.start_date));
  }, [protocol.data, tasks.data, instance.id, instance.start_date]);

  async function handleComplete(taskId: string) {
    try {
      await completeTask.mutateAsync({ id: taskId, dto: {} });
      toast.success(t("stepCompletedToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("error"));
    }
  }

  async function handleReopen(taskId: string) {
    try {
      await reopenTask.mutateAsync(taskId);
      toast.success(t("stepReopenedToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("error"));
    }
  }

  if (protocol.isLoading || tasks.isLoading) {
    return <CardSkeleton lines={4} />;
  }
  if (protocol.isError || tasks.isError) {
    return (
      <ErrorState
        description={t("error")}
        onRetry={() => {
          protocol.refetch();
          tasks.refetch();
        }}
      />
    );
  }

  const items: TimelineItem[] = rows.map((row) => {
    const statusLabel = !row.task
      ? t("noTask")
      : row.task.status === "COMPLETED"
        ? t("statusDone")
        : row.task.status === "CANCELLED"
          ? t("statusCancelled")
          : row.task.displayStatus === "overdue"
            ? t("statusOverdue")
            : row.step.day_number === instance.current_step_day
              ? t("statusCurrent")
              : t("statusUpcoming");

    let action: React.ReactNode = null;
    if (row.step.step_type === "AI") {
      if (!instance.ai_completed_at) {
        action = canUpdate ? (
          <Button size="sm" variant="secondary" className="h-7 px-3 text-xs font-semibold" onClick={() => setAiOpen(true)}>
            {t("recordAi")}
          </Button>
        ) : null;
      } else {
        action = (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent-teal">
            <Check className="size-3.5" /> {t("statusDone")}
          </span>
        );
      }
    } else if (row.step.step_type === "PREGNANCY_CHECK") {
      if (instance.ai_completed_at && !instance.outcome_recorded_at) {
        action = canUpdate ? (
          <Button size="sm" variant="secondary" className="h-7 px-3 text-xs font-semibold" onClick={() => setOutcomeOpen(true)}>
            {t("recordOutcome")}
          </Button>
        ) : null;
      } else if (instance.outcome_recorded_at) {
        action = (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent-teal">
            <Check className="size-3.5" /> {t("statusDone")}
          </span>
        );
      }
    } else if (row.task) {
      if (row.task.status === "COMPLETED") {
        action = (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent-teal">
              <Check className="size-3.5" /> {t("statusDone")}
            </span>
            {canUpdate ? (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
                onClick={() => handleReopen(row.task!.id)}
                disabled={reopenTask.isPending}
              >
                {t("undo")}
              </button>
            ) : null}
          </div>
        );
      } else if (row.task.status !== "CANCELLED") {
        action = canUpdate ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-3 text-xs font-medium"
            onClick={() => handleComplete(row.task!.id)}
            disabled={completeTask.isPending}
          >
            <Check className="mr-1 size-3.5 text-primary" />
            {t("markDone")}
          </Button>
        ) : null;
      }
    }

    return {
      id: `${row.step.day_number}-${row.step.title}`,
      icon: rowIcon(row),
      tone: rowTone(row),
      title: `${t("dayLabel", { value: row.step.day_number })} — ${row.step.title}`,
      subtitle: [row.step.instruction, statusLabel].filter(Boolean).join(" · "),
      date: formatDateTime(row.task?.dueAt ?? row.dueDate, locale) || formatDate(row.task?.dueAt ?? row.dueDate, locale),
      action,
    };
  });

  return (
    <>
      <Timeline items={items} />
      <RecordAiDialog instanceId={instance.id} open={aiOpen} onOpenChange={setAiOpen} />
      <RecordOutcomeDialog instanceId={instance.id} open={outcomeOpen} onOpenChange={setOutcomeOpen} />
    </>
  );
}

/** Day-by-day plan for one applied protocol instance (RAKHAL-214 follow-up, no ticket #) — zips
 * the protocol's step definitions (`GET /reproduction/protocols/:id`) to the Task-Hub tasks each
 * step created (`sourceEventType: 'REPRO_PROTOCOL_INSTANCE'`, `sourceEventId: instance.id`) so a
 * step's done/overdue/upcoming state is real task status, not a guess from `current_step_day` alone. */
export function ProtocolInstanceTimeline({
  instance,
  open,
  onOpenChange,
}: {
  instance: ProtocolInstance | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("reproduction.protocols.timeline");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open && instance ? (
        <SheetContent
          showClose={false}
          className="inset-y-2.5 right-2.5 flex h-[calc(100vh-20px)] w-[calc(100%-20px)] max-w-[560px] flex-col gap-0 rounded-[20px] border-2 border-border p-5 shadow-2xl sm:max-w-[560px]"
        >
          <div className="flex items-center justify-between pb-5">
            <SheetTitle className="text-xl font-bold text-foreground">
              {t("title", { protocol: instance.protocol_name })}
            </SheetTitle>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label={t("close")}
              className="flex size-5 items-center justify-center text-foreground transition-opacity hover:opacity-70"
            >
              <ArrowRightToLine className="size-5" aria-hidden />
            </button>
          </div>
          <div className="border-t border-dashed border-border" />

          <div className="flex-1 overflow-y-auto px-1 py-4">
            <TimelineBody instance={instance} />
          </div>
        </SheetContent>
      ) : null}
    </Sheet>
  );
}
