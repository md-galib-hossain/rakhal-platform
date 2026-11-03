"use client"; // Done action mutation + toast

import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Bell, BellRing, Check, Repeat, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { Can } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { TaskChip } from "./task-chip";
import { TruncatedText } from "@/components/shared/truncated-text";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { useCompleteTask } from "../hooks/use-tasks";
import { reminderAudience, reminderRepeat } from "../reminder-view";
import { DISPLAY_STATUS_CHIP_VARIANT } from "../task-style";
import type { Task } from "../types";

function cowLabel(task: Task): string | null {
  const first = task.relatedCattle ?? task.cattleTags[0];
  if (!first) return null;
  const base = first.name ? `${first.tagNumber} — ${first.name}` : first.tagNumber;
  return !task.relatedCattle && task.cattleTags.length > 1 ? `${base} +${task.cattleTags.length - 1}` : base;
}

/**
 * Task Hub reminder card (kind REMINDER). Deliberately NOT a task card: a bell tile instead of a priority
 * stripe, a "who is told" line instead of an assignee, a Done button instead of assign/blocked. Same tokens.
 */
export function ReminderCard({ task, onOpen }: { task: Task; onOpen: (task: Task) => void }) {
  const t = useTranslations("tasks");
  const locale = useLocale() as Locale;
  const complete = useCompleteTask();

  const isOverdue = task.displayStatus === "overdue";
  const isClosed = task.displayStatus === "completed" || task.displayStatus === "cancelled";
  const Icon = isOverdue ? BellRing : Bell;
  const when = formatDate(task.dueAt, locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const repeat = reminderRepeat(task);
  const audience = reminderAudience(task);
  const cow = cowLabel(task);

  const audienceText =
    audience.type === "people"
      ? t("reminders.card.notifiedPeople", { count: audience.count })
      : audience.type === "roles"
        ? t("reminders.card.notifiedRoles", { roles: audience.roles.map((r) => t(`reminders.roles.${r}` as "reminders.roles.Owner")).join(", ") })
        : audience.name
          ? t("reminders.card.notifiedAssignee", { name: audience.name })
          : t("reminders.card.notifiedNobody");

  async function handleDone() {
    try {
      await complete.mutateAsync({ id: task.id, dto: {} });
      toast.success(t("reminders.card.doneToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("reminders.card.genericError"));
    }
  }

  return (
    <div
      className={cn(
        "relative flex h-full w-full items-start gap-3 rounded-xl border border-info/30 bg-card p-3 transition-colors hover:bg-accent/40 focus-within:ring-2 focus-within:ring-ring sm:p-4",
        isOverdue && "border-destructive/40",
        isClosed && "opacity-70",
      )}
    >
      <span
        aria-hidden
        className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", isOverdue ? "bg-destructive/15 text-destructive" : "bg-info/15 text-info")}
      >
        <Icon className="size-5" />
      </span>
      <div className="flex h-full min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => onOpen(task)}
            className={cn("min-w-0 text-left text-base font-bold leading-snug text-foreground outline-none after:absolute after:inset-0", isClosed && "line-through")}
          >
            <TruncatedText lines={2}>{task.name}</TruncatedText>
          </button>
          <TaskChip variant={DISPLAY_STATUS_CHIP_VARIANT[task.displayStatus]} subtle className="shrink-0">
            {t(`status.${task.displayStatus}`)}
          </TaskChip>
        </div>

        <p className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold", isOverdue ? "text-destructive-text" : "text-foreground")}>
          <span>{when}</span>
          {repeat ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Repeat className="size-3.5" aria-hidden />
              {repeat.type === "everyN"
                ? t("reminders.card.repeatsEveryN", { count: repeat.n })
                : t(repeat.type === "weekly" ? "reminders.card.repeatsWeekly" : "reminders.card.repeatsMonthly")}
            </span>
          ) : null}
          {task.remindDaysBefore ? (
            <span className="text-xs font-medium text-muted-foreground">{t("reminders.card.leadNotice", { count: task.remindDaysBefore })}</span>
          ) : null}
        </p>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-col gap-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4 shrink-0" aria-hidden />
              <TruncatedText className="max-w-[240px]">{audienceText}</TruncatedText>
            </span>
            {cow ? <TruncatedText className="max-w-[240px] font-medium text-foreground">{cow}</TruncatedText> : null}
          </div>
          {!isClosed ? (
            <Can I="task.complete">
              <Button type="button" variant="outline" size="sm" className="relative z-10 h-11 sm:h-9" onClick={() => void handleDone()} disabled={complete.isPending}>
                <Check className="size-4" aria-hidden />
                {complete.isPending ? "…" : t("reminders.card.done")}
              </Button>
            </Can>
          ) : null}
        </div>
      </div>
    </div>
  );
}
