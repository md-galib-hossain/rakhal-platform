"use client"; // month nav + day-select state

import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHealthTaskCalendar } from "../hooks/use-health";

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Task Hub calendar strip — Figma "Calendar" (734:41130, `get_design_context`): month nav + a
 * weekday-aligned day grid, a colored dot under any day with open tasks (red = has an overdue task,
 * amber = has a pending/upcoming one — both real, from `GET /health/tasks/calendar`'s per-date
 * `counts` breakdown, not decorative). Clicking a day sets it as the active date filter; clicking the
 * already-selected day clears it back to "no date filter".
 */
export function TaskCalendarStrip({
  year,
  month,
  onMonthChange,
  selectedDate,
  onSelectDate,
}: {
  year: number;
  month: number; // 1-12
  onMonthChange: (year: number, month: number) => void;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}) {
  const t = useTranslations("health.taskHub.calendar");
  const query = useHealthTaskCalendar(year, month);
  const countsByDate = new Map((query.data ?? []).map((d) => [d.date, d.counts]));

  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();
  const todayKey = new Date().toISOString().slice(0, 10);

  const cells: Array<{ day: number; dateKey: string } | null> = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, dateKey: toDateKey(year, month, i + 1) })),
  ];

  function prevMonth() {
    onMonthChange(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1);
  }
  function nextMonth() {
    onMonthChange(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1);
  }

  const monthLabel = firstOfMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted p-3">
      <div className="flex w-[157px] shrink-0 items-center justify-between rounded-md border border-border bg-card p-2 shadow-sm">
        <button type="button" onClick={prevMonth} aria-label={t("prevMonth")} className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-3.5" aria-hidden />
        </button>
        <span className="text-xs text-muted-foreground">{monthLabel}</span>
        <button type="button" onClick={nextMonth} aria-label={t("nextMonth")} className="text-muted-foreground hover:text-foreground">
          <ChevronRight className="size-3.5" aria-hidden />
        </button>
      </div>
      <div className="h-24 w-px shrink-0 bg-border" aria-hidden />
      <div className="flex flex-1 flex-col gap-2">
        <div className="grid grid-cols-7">
          {WEEKDAY_KEYS.map((key) => (
            <span key={key} className="text-center text-xs text-muted-foreground">
              {t(`weekday.${key}`)}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-2">
          {cells.map((cell, i) => {
            if (!cell) return <span key={`blank-${i}`} />;
            const counts = countsByDate.get(cell.dateKey);
            const hasOverdue = (counts?.OVERDUE ?? 0) > 0;
            const hasPending = (counts?.PENDING ?? 0) > 0;
            const isToday = cell.dateKey === todayKey;
            const isSelected = cell.dateKey === selectedDate;
            return (
              <button
                key={cell.dateKey}
                type="button"
                onClick={() => onSelectDate(isSelected ? null : cell.dateKey)}
                className={cn(
                  "relative mx-auto flex size-6 items-center justify-center rounded-full text-xs",
                  isSelected ? "bg-primary text-primary-foreground" : isToday ? "font-bold text-foreground" : "text-foreground",
                )}
              >
                {cell.day}
                {!isSelected && (hasOverdue || hasPending) ? (
                  <span className={cn("absolute -bottom-1 size-1 rounded-full", hasOverdue ? "bg-destructive" : "bg-warning")} />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
