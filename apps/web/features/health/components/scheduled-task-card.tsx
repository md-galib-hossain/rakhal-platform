"use client"; // action button callbacks

import { useTranslations } from "next-intl";
import { ArrowRight, Bell, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { daysFromToday, groupCompletedCount, isGroupOverdue, nextReminder, taskCategoryChip, type ScheduledTaskGroup } from "../task-grouping";

/** RFE-137 — relative wording ("In 3 days", "2 days overdue") matching the reminder notifications, so the card and
 * the bell say the same thing; the absolute date is the chip's tooltip. */
function dueLabel(t: ReturnType<typeof useTranslations>, dueDateTime: string): string {
  const diff = daysFromToday(dueDateTime);
  if (diff === 0) return t("dueToday");
  if (diff === 1) return t("dueTomorrow");
  if (diff > 1) return t("dueInDays", { days: diff });
  if (diff === -1) return t("dueYesterday");
  return t("overdueDays", { days: -diff });
}

function dueDateText(dueDateTime: string): string {
  return new Date(dueDateTime).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

/**
 * A step group as a compact card (RFE-145, EPIC_PROTOCOL_ROUNDS D5). It used to be ~400px — Due / Medicine / Dose tiles,
 * an Action box, a progress bar — and the Action box usually repeated the title. Now: the title with its category and
 * due chip, ONE line for what is given ("Ceftriaxone · 5 ml"), the instruction only when it adds something, one
 * progress line with who is in it, and the two buttons. Used for the sheet's "Not part of a protocol" target; a
 * protocol's own steps are the Progress grid's columns and cells.
 * The primary button is disabled until the group is due; once every animal's task is done it reads "Completed".
 */
export function ScheduledTaskCard({
  group,
  onReschedule,
  onRecord,
}: {
  group: ScheduledTaskGroup;
  onReschedule: (group: ScheduledTaskGroup) => void;
  onRecord: (group: ScheduledTaskGroup) => void;
}) {
  const t = useTranslations("health.taskHub.card");
  const completed = groupCompletedCount(group);
  const total = group.tasks.length;
  const overdue = isGroupOverdue(group);
  const isFuture = daysFromToday(group.dueDateTime) > 0;
  const isDone = completed >= total;
  const category = taskCategoryChip(group.taskType);
  const fillPct = total > 0 ? (completed / total) * 100 : 0;
  const animalLabels = group.tasks.map((task) => task.cattle?.name ?? task.cattle?.tagNumber ?? task.cattleId);
  const visibleAnimalLabels = animalLabels.slice(0, 3);
  const extraAnimalCount = animalLabels.length - visibleAnimalLabels.length;

  const given = [group.medicineName, group.doseAmount != null ? `${group.doseAmount} ${group.doseUnit ?? ""}`.trim() : null].filter(Boolean).join(" · ");
  // The instruction is shown only when it says something the title and the medicine line do not already say.
  const instruction = group.instruction && group.instruction !== group.title && group.instruction !== group.medicineName ? group.instruction : null;

  // What the backend will do next for this step (RAKHAL-465): remind 7/3/1 days before and on the day, then daily
  // until it is done. A finished group needs no reminder line.
  let reminderText: string | null = null;
  if (!isDone) {
    const next = nextReminder(group.dueDateTime);
    if (next) {
      reminderText =
        daysFromToday(next.date.toISOString()) === 0
          ? t("reminderToday")
          : t("nextReminder", {
              date: next.date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }),
              when: t("reminderWhen", { days: next.daysBefore }),
            });
    } else if (overdue) {
      reminderText = t("remindedDaily");
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-base font-bold text-foreground">{group.title}</p>
        <Chip variant={category.variant}>{t(`category.${category.labelKey}`)}</Chip>
        <Chip variant={overdue ? "destructive" : "muted"} title={dueDateText(group.dueDateTime)}>
          {dueLabel(t, group.dueDateTime)}
        </Chip>
      </div>

      {given || instruction ? (
        <div className="flex flex-col gap-0.5 text-sm">
          {given ? <p className="text-foreground">{given}</p> : null}
          {instruction ? <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{instruction}</p> : null}
        </div>
      ) : null}

      {reminderText ? (
        <p className={cn("flex items-center gap-1.5 text-xs", overdue ? "text-destructive" : "text-muted-foreground")}>
          <Bell className="size-3.5 shrink-0" aria-hidden />
          {reminderText}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="shrink-0 font-semibold">{t("animalCount", { completed, total })}</span>
          <span className="truncate">
            {visibleAnimalLabels.join(", ")}
            {extraAnimalCount > 0 ? ` ${t("animalNamesMore", { count: extraAnimalCount })}` : ""}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted">
          <div className="h-1.5 rounded-full bg-primary transition-[width] duration-500" style={{ width: `${fillPct}%` }} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" className="h-10 flex-1 gap-2 text-sm" onClick={() => onReschedule(group)}>
          {t("reschedule")}
          <CalendarDays className="size-[18px]" aria-hidden />
        </Button>
        <Button type="button" className="h-10 flex-1 gap-2 text-sm" disabled={isFuture || isDone} onClick={() => onRecord(group)}>
          {isDone ? t("completed") : completed === 0 ? t("recordBatch") : t("resumeRecording")}
          {!isDone ? <ArrowRight className="size-[18px]" aria-hidden /> : null}
        </Button>
      </div>
    </div>
  );
}
