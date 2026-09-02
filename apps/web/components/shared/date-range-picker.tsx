"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PERIOD_PRESET_VALUES, type PeriodPreset, type PeriodRange } from "@/lib/period/presets";

const SELECTABLE_PRESETS = PERIOD_PRESET_VALUES.filter((p): p is Exclude<PeriodPreset, "custom"> => p !== "custom");

export interface DateRangePickerProps {
  preset: PeriodPreset;
  range: PeriodRange;
  /** Pre-formatted label for the trigger button — pass `usePeriod().label`. */
  label: string;
  onPresetChange: (preset: Exclude<PeriodPreset, "custom">) => void;
  onRangeChange: (from: Date, to: Date) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * `DateRangePicker` (RAKHAL-380, MILESTONE 22, `BUSINESS_IA_PRD.md` §4.4,
 * §6.1). `Popover` + `components/ui/calendar.tsx` in range mode + a preset
 * column (Today / This Week / This Month / Last Month / This Quarter / This
 * Year / Custom) — no such component existed before this ticket, so every
 * finance screen was period-blind. Deliberately decoupled from `usePeriod()`
 * (this file has no nuqs import) — a plain controlled component, same
 * `value`/`onChange` shape `components/ui/date-picker.tsx` already
 * established, so it can be driven by any state source, not only the URL.
 */
export function DateRangePicker({
  preset,
  range,
  label,
  onPresetChange,
  onRangeChange,
  disabled,
  className,
}: DateRangePickerProps) {
  const t = useTranslations("period.presets");
  const [open, setOpen] = useState(false);
  /**
   * In-progress range. react-day-picker reports the first click of a new range as
   * `{ from, to: undefined }`; the old code discarded that update and kept feeding the *committed*
   * range back in as `selected`, so the first click of a two-click selection appeared to do nothing
   * (the reported "selecting date is not working properly for multiple date select"). The draft
   * holds the half-made range so the start day highlights immediately, and only a complete
   * `from`+`to` is pushed to the parent.
   */
  const [draft, setDraft] = useState<DateRange | undefined>(undefined);
  const selectedRange: DateRange = draft ?? { from: range.from, to: range.to };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Abandon a half-made range when the popover closes, so reopening starts clean.
        if (!next) setDraft(undefined);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-11 justify-start gap-2 font-normal",
            className,
          )}
        >
          <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="truncate">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-auto gap-2 rounded-2xl p-3 shadow-lg">
        <div className="flex w-40 flex-col gap-0.5 border-r border-border pr-3">
          {SELECTABLE_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setDraft(undefined);
                onPresetChange(p);
                setOpen(false);
              }}
              className={cn(
                "rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent",
                preset === p ? "bg-accent font-medium text-accent-foreground" : "text-foreground",
              )}
            >
              {t(p)}
            </button>
          ))}
          {/* Not a button: "Custom" isn't a preset you pick, it's the state the calendar puts you
              in. It stays as a status row, but now explains how to get there instead of looking
              like a dead menu item. */}
          <span
            className={cn(
              "mt-1 rounded-md px-3 py-2 text-left text-xs leading-snug",
              preset === "custom" ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground",
            )}
          >
            {t("custom")}
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{t("customHint")}</span>
          </span>
        </div>
        <Calendar
          mode="range"
          numberOfMonths={1}
          // Without this, react-day-picker only ever EXTENDS the committed range (a click after
          // `from` just moves `to`), so a farmer trying to pick a fresh Aug 5 → Aug 12 window
          // silently got Sep 1 → Aug 5 instead. `resetOnSelect` restores the expected two-click
          // "click the start, click the end" flow.
          resetOnSelect
          defaultMonth={selectedRange.from}
          selected={selectedRange}
          onSelect={(selected) => {
            if (!selected?.from) {
              setDraft(undefined);
              return;
            }
            if (!selected.to) {
              // First click of a new range — keep the popover open and show the start day.
              setDraft(selected);
              return;
            }
            setDraft(undefined);
            onRangeChange(selected.from, selected.to);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
