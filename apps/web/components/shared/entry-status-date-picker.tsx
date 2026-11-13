"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { useLocale } from "next-intl";
import { CalendarDays } from "lucide-react";
import type { Matcher } from "react-day-picker";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@rakhal/ui/ui/popover";
import { PickerFooter } from "@/components/ui/date-picker";

/** Same shape as `EntryCalendarDayStatus` in `features/milk/types.ts` and `features/feed/types.ts`
 * (duplicated per-feature per this repo's feature-isolation convention — kept in sync manually,
 * both mirror the backend's `MilkService.logCalendar()`/`FeedFeedingGridService.calendar()`). */
export type EntryStatusDay = { date: string; status: string };

export interface EntryStatusDatePickerProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Current month's day statuses (RAKHAL-434/RFE-118) — `missing` days get a red dot, `partial` an
   * amber one. `complete`/`future`/`before_farm` render plain. */
  days: EntryStatusDay[];
  /** Fires when the visible month changes (including the initial popover open) — the caller should
   * refetch/keep the query keyed on this `YYYY-MM` string. */
  onMonthChange: (month: string) => void;
  disabledDates?: Matcher | Matcher[];
  className?: string;
}

/**
 * Missed-entry calendar picker (RAKHAL-434 plan) — a `DatePicker`-alike that colors each day by
 * entry status instead of being a plain date field. Built as a new shared component rather than
 * extending `components/ui/date-picker.tsx` in place, per this repo's hot-shared-file convention
 * (new file, not a rewrite of a file other lanes may depend on). Reuses the same `Calendar`/
 * `Popover`/`PickerFooter` building blocks `DatePicker` already uses, so it matches the app's
 * existing date-field chrome exactly.
 */
export function EntryStatusDatePicker({
  id,
  label,
  value,
  onChange,
  days,
  onMonthChange,
  disabledDates,
  className,
}: EntryStatusDatePickerProps) {
  const locale = useLocale() as Locale;
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;

  const missingDates = days.filter((d) => d.status === "missing").map((d) => parseISO(d.date));
  const partialDates = days.filter((d) => d.status === "partial").map((d) => parseISO(d.date));

  return (
    <div className="w-full">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) onMonthChange(format(selected ?? new Date(), "yyyy-MM"));
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            className={cn(
              "flex h-11 w-full items-center gap-2 rounded-md border border-input bg-card px-3.5 text-left shadow-xs transition-colors hover:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              className,
            )}
          >
            <span className="sr-only">{label}</span>
            <span className={cn("min-w-0 flex-1 truncate text-sm", selected ? "text-foreground" : "text-muted-foreground")}>
              {selected ? formatDate(selected, locale) : label}
            </span>
            <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto rounded-2xl p-0 shadow-lg">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            disabled={disabledDates}
            onMonthChange={(month) => onMonthChange(format(month, "yyyy-MM"))}
            modifiers={{ missing: missingDates, partial: partialDates }}
            modifiersClassNames={{
              missing:
                "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:size-1.5 after:rounded-full after:bg-destructive",
              partial:
                "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:size-1.5 after:rounded-full after:bg-warning",
            }}
            onSelect={(date) => {
              if (!date) return;
              onChange(format(date, "yyyy-MM-dd"));
              setOpen(false);
            }}
          />
          <PickerFooter
            onToday={() => {
              onChange(format(new Date(), "yyyy-MM-dd"));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
