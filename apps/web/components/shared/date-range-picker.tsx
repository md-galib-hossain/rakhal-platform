"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays } from "lucide-react";
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
      <PopoverContent align="start" className="flex w-auto gap-2 rounded-2xl p-2 shadow-lg">
        <div className="flex w-40 flex-col gap-0.5 border-r border-border pr-2">
          {SELECTABLE_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                onPresetChange(p);
                setOpen(false);
              }}
              className={cn(
                "rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                preset === p ? "bg-accent font-medium text-accent-foreground" : "text-foreground",
              )}
            >
              {t(p)}
            </button>
          ))}
          <span
            className={cn(
              "rounded-md px-3 py-2 text-left text-sm",
              preset === "custom" ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground",
            )}
          >
            {t("custom")}
          </span>
        </div>
        <Calendar
          mode="range"
          numberOfMonths={1}
          defaultMonth={range.from}
          selected={{ from: range.from, to: range.to }}
          onSelect={(selected) => {
            if (!selected?.from || !selected?.to) return;
            onRangeChange(selected.from, selected.to);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
