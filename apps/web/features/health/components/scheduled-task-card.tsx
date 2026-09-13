"use client"; // action button callbacks

import { useTranslations } from "next-intl";
import { ArrowRight, CalendarDays, Info, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { daysFromToday, groupCompletedCount, isGroupOverdue, taskCategoryChip, type ScheduledTaskGroup } from "../task-grouping";

function InfoTile({ label, value, overdue }: { label: string; value: string; overdue?: boolean }) {
  return (
    <div className={cn("flex flex-1 flex-col gap-3 rounded-lg border p-2", overdue ? "border-destructive/30" : "border-border")}>
      <div className="flex items-center justify-between gap-1">
        <span className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
          <Package className="size-3.5" aria-hidden />
          {label}
        </span>
        {overdue ? <Info className="size-3.5 text-destructive" aria-hidden /> : null}
      </div>
      <p className="truncate text-sm text-foreground">{value}</p>
    </div>
  );
}

function dueLabel(t: ReturnType<typeof useTranslations>, dueDateTime: string): string {
  const diff = daysFromToday(dueDateTime);
  if (diff === 0) return t("dueToday");
  if (diff === -1) return t("dueYesterday");
  if (diff === 1) return t("dueTomorrow");
  return new Date(dueDateTime).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * "Scheduled Task Card" — Figma "Inventory - Semen"... no, Healthcare "Task Hub" (734:41139 etc.,
 * `get_design_context`): title + category chip, Due/Medicine/Dose info tiles, an Action row, a
 * progress bar, then Reschedule + primary-action buttons. The primary button is disabled (matches
 * the mock's `opacity-20` state on future-dated cards) until the group is actually due; once every
 * animal's task is done it reads "Completed" instead of "Record Batch" — a state the mock doesn't
 * picture but is a real, necessary status this data can be in.
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

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <p className="flex-1 truncate text-xl font-bold text-foreground">{group.title}</p>
        <Chip variant={category.variant}>{t(`category.${category.labelKey}`)}</Chip>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <InfoTile label={t("due")} value={dueLabel(t, group.dueDateTime)} overdue={overdue} />
          <InfoTile label={t("medicine")} value={group.medicineName ?? "—"} />
          <InfoTile label={t("dose")} value={group.doseAmount != null ? `${group.doseAmount} ${group.doseUnit ?? ""}`.trim() : "—"} />
        </div>
        <div className="rounded-lg border border-border p-2">
          <span className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
            <Package className="size-3.5" aria-hidden />
            {t("action")}
          </span>
          <p className="mt-2 text-sm text-foreground">{group.instruction ?? "—"}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 font-bold text-muted-foreground">
            <Package className="size-3.5" aria-hidden />
            {t("progress")}
          </span>
          <span className="text-muted-foreground">{t("animalCount", { completed, total })}</span>
        </div>
        <div className="h-[17px] w-full rounded-md bg-muted">
          <div className="h-[17px] rounded-md bg-primary transition-[width] duration-500" style={{ width: `${fillPct}%` }} />
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {visibleAnimalLabels.join(", ")}
          {extraAnimalCount > 0 ? ` ${t("animalNamesMore", { count: extraAnimalCount })}` : ""}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" className="h-11 flex-1 gap-2 text-sm" onClick={() => onReschedule(group)}>
          {t("reschedule")}
          <CalendarDays className="size-[18px]" aria-hidden />
        </Button>
        <Button type="button" className="h-11 flex-1 gap-2 text-sm" disabled={isFuture || isDone} onClick={() => onRecord(group)}>
          {isDone ? t("completed") : completed === 0 ? t("recordBatch") : t("resumeRecording")}
          {!isDone ? <ArrowRight className="size-[18px]" aria-hidden /> : null}
        </Button>
      </div>
    </div>
  );
}
