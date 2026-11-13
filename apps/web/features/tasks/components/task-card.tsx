import { useLocale, useTranslations } from "next-intl";
import { CalendarClock, ChevronRight, PawPrint } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskChip } from "./task-chip";
import { Avatar, AvatarFallback } from "@rakhal/ui/ui/avatar";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { avatarTint, initials } from "../avatar-tint";
import { DISPLAY_STATUS_CHIP_VARIANT, PRIORITY_CHIP_VARIANT } from "../task-style";
import { LACTATION_ALERT_ICON, lactationAlertSeverity, parseLactationAlert } from "../lactation-alert";
import type { Task, TaskPriority } from "../types";
import { TruncatedText } from "@/components/shared/truncated-text";

/** Cow label — reuses the tag/name convention of the rest of the app. */
function cattleLabel(c: { tagNumber: string; name: string | null }) {
  return c.name ? `${c.tagNumber} — ${c.name}` : c.tagNumber;
}
function cattleSummary(task: Task): string | null {
  if (task.relatedCattle) return cattleLabel(task.relatedCattle);
  if (task.cattleTags.length === 0) return null;
  if (task.cattleTags.length === 1) return cattleLabel(task.cattleTags[0]);
  return `${cattleLabel(task.cattleTags[0])} +${task.cattleTags.length - 1}`;
}

/** Left accent so priority scans without reading a label. */
const PRIORITY_STRIPE: Record<TaskPriority, string> = {
  HIGH: "before:bg-destructive",
  MEDIUM: "before:bg-warning",
  LOW: "before:bg-primary",
};

/**
 * Task Hub card, redesigned for scanning (T-20261103-galib-01): one line per question —
 * WHAT (title + category), WHEN (due, red if overdue), WHICH ANIMAL, WHO (assignee), STATUS (chip top
 * right). Priority is the left stripe (+ a chip only for High). The whole card opens the details
 * sheet through the title button (stretched link pattern), so there is no separate "See details" row.
 */
export function TaskCard({ task, onSeeDetails }: { task: Task; onSeeDetails: (task: Task) => void }) {
  const t = useTranslations("tasks");
  const locale = useLocale() as Locale;

  const isOverdue = task.displayStatus === "overdue";
  const dueText = formatDate(task.dueAt, locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const dueLabel = isOverdue && task.overdueByHours !== null ? `${dueText} · ${t("card.overdueBy", { hours: task.overdueByHours })}` : dueText;

  // RAKHAL-286 lactation alerts ride this list — decode the dedupe marker so it never leaks to the farmer.
  const lactationAlert = parseLactationAlert(task.details);
  const LactationIcon = lactationAlert ? LACTATION_ALERT_ICON[lactationAlert.kind] : null;
  const visibleDetails = lactationAlert ? lactationAlert.cleanDetails : task.details;

  // Completed/cancelled must never look like a live task — muted, struck-through, status chip.
  const isClosed = task.displayStatus === "completed" || task.displayStatus === "cancelled";
  const cow = cattleSummary(task);

  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card py-3 pl-5 pr-4 transition-colors hover:bg-accent/40 focus-within:ring-2 focus-within:ring-ring",
        "before:absolute before:inset-y-0 before:left-0 before:w-1.5",
        PRIORITY_STRIPE[task.priority],
        isClosed && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="flex flex-wrap items-center gap-x-2 text-xs font-medium text-muted-foreground">
            <span>{t(`category.${task.category}`)}</span>
            <span aria-hidden>·</span>
            <span className="font-bold">{task.reference}</span>
          </p>
          <button
            type="button"
            onClick={() => onSeeDetails(task)}
            className={cn(
              "text-left text-base font-bold leading-snug text-foreground outline-none after:absolute after:inset-0",
              isClosed && "line-through",
            )}
          >
            <TruncatedText lines={2}>{task.name}</TruncatedText>
          </button>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <TaskChip variant={DISPLAY_STATUS_CHIP_VARIANT[task.displayStatus]} subtle>
            {t(`status.${task.displayStatus}`)}
          </TaskChip>
          {task.priority === "HIGH" ? (
            <TaskChip variant={PRIORITY_CHIP_VARIANT.HIGH} subtle>
              {t("priority.HIGH")}
            </TaskChip>
          ) : null}
        </div>
      </div>

      {lactationAlert && LactationIcon ? (
        <TaskChip variant={lactationAlertSeverity(lactationAlert.kind)} subtle className="w-fit gap-1.5">
          <LactationIcon className="size-3.5" aria-hidden />
          {t(`lactationAlert.${lactationAlert.kind}`)}
        </TaskChip>
      ) : null}
      {visibleDetails ? (
        <TruncatedText lines={1} className="text-sm text-muted-foreground">
          {visibleDetails}
        </TruncatedText>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border pt-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className={cn("inline-flex items-center gap-1.5 font-semibold", isOverdue ? "text-destructive-text" : "text-foreground")}>
            <CalendarClock className="size-4 shrink-0" aria-hidden />
            {dueLabel}
          </span>
          {cow ? (
            <span className="inline-flex min-w-0 items-center gap-1.5 text-foreground">
              <PawPrint className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <TruncatedText className="max-w-[180px] font-medium">{cow}</TruncatedText>
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-sm">
          {task.assignedTo ? (
            <>
              <Avatar className="size-6">
                <AvatarFallback className={avatarTint(task.assignedTo.id)}>{initials(task.assignedTo.name)}</AvatarFallback>
              </Avatar>
              <TruncatedText className="max-w-[120px] font-medium text-foreground">{task.assignedTo.name}</TruncatedText>
            </>
          ) : (
            <span className="text-muted-foreground">{t("card.unassigned")}</span>
          )}
          <ChevronRight className="size-4 text-muted-foreground rtl:rotate-180" aria-hidden />
        </div>
      </div>
    </div>
  );
}
