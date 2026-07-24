"use client"; // month nav + day-select state

import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/ui/chip";
import { isGroupOverdue, taskCategoryChip, type ScheduledTaskGroup } from "../task-grouping";

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
/** Cells are ~110px tall — 3 chips (24px each) plus the day number is what actually fits before
 * scrolling inside a cell would be needed; anything past that collapses into "+N more" instead. */
const MAX_VISIBLE_CHIPS = 3;

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Task Hub calendar — a real month grid (Figma "Calendar" 734:41130 called for a compact dot-strip,
 * but that read as a generic date-picker rather than a calendar; rebuilt as a bordered week-grid with
 * each day's actual scheduled-task titles shown as chips inline, same visual language a content/ops
 * calendar uses). Chips reuse the existing `taskCategoryChip` mapping (medical/prevention/general)
 * that `ScheduledTaskCard` already applies, so a day's color-coding matches the card list below it —
 * no separate legend to learn. Clicking a day (or one of its chips) sets it as the active date filter
 * for the card list; clicking the already-selected day clears it back to "no date filter".
 */
export function TaskCalendarStrip({
  year,
  month,
  onMonthChange,
  selectedDate,
  onSelectDate,
  groups,
}: {
  year: number;
  month: number; // 1-12
  onMonthChange: (year: number, month: number) => void;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  groups: ScheduledTaskGroup[];
}) {
  const t = useTranslations("health.taskHub.calendar");

  const groupsByDate = new Map<string, ScheduledTaskGroup[]>();
  for (const group of groups) {
    const dateKey = group.dueDateTime.slice(0, 10);
    const list = groupsByDate.get(dateKey);
    if (list) list.push(group);
    else groupsByDate.set(dateKey, [group]);
  }

  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();
  const todayKey = new Date().toISOString().slice(0, 10);

  const cells: Array<{ day: number; dateKey: string } | null> = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, dateKey: toDateKey(year, month, i + 1) })),
  ];
  // Trailing blanks so the grid always ends on a full week — a ragged last row reads as broken.
  while (cells.length % 7 !== 0) cells.push(null);

  function prevMonth() {
    onMonthChange(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1);
  }
  function nextMonth() {
    onMonthChange(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1);
  }

  const monthLabel = firstOfMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center justify-between px-1">
        <p className="text-sm font-bold text-foreground">{monthLabel}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            aria-label={t("prevMonth")}
            className="flex size-7 items-center justify-center rounded-sm border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            aria-label={t("nextMonth")}
            className="flex size-7 items-center justify-center rounded-sm border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-7 bg-muted">
          {WEEKDAY_KEYS.map((key) => (
            <span key={key} className="border-b border-border px-2 py-2 text-center text-xs font-medium text-muted-foreground">
              {t(`weekday.${key}`)}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell, i) => {
            if (!cell) return <div key={`blank-${i}`} className="min-h-24 border-b border-r border-border bg-muted/30 sm:min-h-28" />;

            const dayGroups = groupsByDate.get(cell.dateKey) ?? [];
            const hasOverdue = dayGroups.some(isGroupOverdue);
            const visibleGroups = dayGroups.slice(0, MAX_VISIBLE_CHIPS);
            const hiddenCount = dayGroups.length - visibleGroups.length;
            const isToday = cell.dateKey === todayKey;
            const isSelected = cell.dateKey === selectedDate;
            const isLastCol = (i + 1) % 7 === 0;

            return (
              <button
                key={cell.dateKey}
                type="button"
                onClick={() => onSelectDate(isSelected ? null : cell.dateKey)}
                className={cn(
                  "flex min-h-24 flex-col items-stretch gap-1 border-b border-border p-1.5 text-left align-top transition-colors sm:min-h-28",
                  !isLastCol && "border-r",
                  isSelected ? "bg-primary/10" : "bg-card hover:bg-muted/60",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 items-center justify-center self-start rounded-full text-xs",
                    isSelected
                      ? "bg-primary font-bold text-primary-foreground"
                      : isToday
                        ? "font-bold text-primary"
                        : "text-foreground",
                  )}
                >
                  {cell.day}
                </span>

                {dayGroups.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {visibleGroups.map((group) => {
                      const chip = taskCategoryChip(group.taskType);
                      return (
                        <span
                          key={group.key}
                          className={cn(
                            "truncate rounded-sm px-1.5 py-0.5 text-left text-[11px] font-medium",
                            chip.variant === "info" && "bg-info/15 text-info",
                            chip.variant === "indigo" && "bg-accent-indigo/15 text-accent-indigo",
                            chip.variant === "muted" && "bg-muted text-muted-foreground",
                            isGroupOverdue(group) && "bg-destructive/15 text-destructive",
                          )}
                          title={group.title}
                        >
                          {group.title}
                        </span>
                      );
                    })}
                    {hiddenCount > 0 ? (
                      <span className="px-1.5 text-[11px] font-medium text-muted-foreground">
                        {t("moreCount", { count: hiddenCount })}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {hasOverdue ? (
                  <Chip variant="destructive" className="mt-auto self-start px-1.5 py-0 text-[9px]">
                    !
                  </Chip>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
