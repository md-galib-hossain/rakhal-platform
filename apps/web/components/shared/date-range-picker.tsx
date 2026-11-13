"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@rakhal/ui/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@rakhal/ui/ui/popover";
import { PERIOD_PRESET_VALUES, type PeriodPreset, type PeriodRange } from "@/lib/period/presets";

const SELECTABLE_PRESETS = PERIOD_PRESET_VALUES.filter((p): p is Exclude<PeriodPreset, "custom"> => p !== "custom");

/**
 * One row of a caller-supplied shortcut list (replaces the built-in finance presets). `range: null`
 * means "no date constraint" (e.g. an "All dates" row) — picking it hands `null` to `onOptionSelect`.
 */
export interface DateRangeOption {
  id: string;
  label: string;
  range: PeriodRange | null;
}

export interface DateRangePickerProps {
  /** Built-in (finance) preset mode. Ignored when `options` is passed. */
  preset?: PeriodPreset;
  range: PeriodRange;
  /** Pre-formatted label for the trigger button — pass `usePeriod().label`. */
  label: string;
  onPresetChange?: (preset: Exclude<PeriodPreset, "custom">) => void;
  /** Fires with a complete range; a single day arrives as `from === to` (same calendar day). */
  onRangeChange: (from: Date, to: Date) => void;
  /** Custom shortcut list — switches the picker out of finance-preset mode. */
  options?: DateRangeOption[];
  /** Which `options` row is active (`"custom"` highlights the calendar-pick row). */
  activeOptionId?: string;
  onOptionSelect?: (option: DateRangeOption) => void;
  /** Text for the "Apply" button shown while a single start day is picked (options mode). */
  applyLabel?: string;
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
 *
 * Task Hub (no ticket) added the optional `options` mode: the caller supplies its own shortcut
 * rows (forward-looking ones like Tomorrow / Next 7 days, an "All dates" clear row), and a single
 * day can be committed by clicking it once and pressing Apply (or clicking it twice).
 */
export function DateRangePicker({
  preset,
  range,
  label,
  onPresetChange,
  onRangeChange,
  options,
  activeOptionId,
  onOptionSelect,
  applyLabel,
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
  const customActive = options ? activeOptionId === "custom" : preset === "custom";

  const commit = (from: Date, to: Date) => {
    setDraft(undefined);
    onRangeChange(from, to);
    setOpen(false);
  };

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
      <PopoverContent
        align="start"
        className="flex max-h-[85dvh] w-auto max-w-[calc(100vw-2rem)] flex-col gap-2 overflow-y-auto rounded-2xl p-3 shadow-lg sm:flex-row"
      >
        <div className="flex flex-row flex-wrap gap-0.5 border-b border-border pb-3 sm:w-40 sm:flex-col sm:flex-nowrap sm:border-r sm:border-b-0 sm:pr-3 sm:pb-0">
          {options
            ? options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    setDraft(undefined);
                    onOptionSelect?.(o);
                    setOpen(false);
                  }}
                  className={cn(
                    "rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent",
                    activeOptionId === o.id ? "bg-accent font-medium text-accent-foreground" : "text-foreground",
                  )}
                >
                  {o.label}
                </button>
              ))
            : SELECTABLE_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setDraft(undefined);
                    onPresetChange?.(p);
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
              customActive ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground",
            )}
          >
            {t("custom")}
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{t("customHint")}</span>
          </span>
        </div>
        <div className="flex flex-col items-stretch gap-2">
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
            onSelect={(selected, triggerDate) => {
              if (!selected?.from) {
                setDraft(undefined);
                return;
              }
              if (!selected.to) {
                // Clicking the start day again (options mode) makes it a one-day range, pending Apply.
                if (options && draft?.from && triggerDate && draft.from.toDateString() === triggerDate.toDateString()) {
                  setDraft({ from: draft.from, to: draft.from });
                  return;
                }
                // First click of a new range — keep the popover open and show the start day.
                setDraft(selected);
                return;
              }
              // Options mode: hold the finished range until Apply so the user can review/adjust it.
              if (options) {
                setDraft(selected);
                return;
              }
              commit(selected.from, selected.to);
            }}
          />
          {options && draft?.from ? (
            <Button type="button" size="sm" onClick={() => commit(draft.from!, draft.to ?? draft.from!)}>
              {applyLabel}
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
