"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { useLocale } from "next-intl";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import type { Matcher } from "react-day-picker";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

/**
 * Rakhal-themed replacement for `<input type="date">` — the native control renders the browser's
 * own OS-styled calendar icon and popup (unstyleable, ignores `--card`/`--border`/dark mode, reads
 * broken in dark theme). Built from the app's own `Calendar` (react-day-picker, already
 * token-driven via `bg-primary`/`bg-accent`/etc — previously scaffolded but unused) + `Popover`, in
 * the same stacked-label chrome as `LabeledInput` so it drops into an existing form grid unchanged.
 * `value`/`onChange` are plain `"yyyy-MM-dd"` strings — the same shape `<input type="date">`
 * produced — so this is a drop-in swap for any zod `z.string()` date field, wired via `Controller`
 * since there's no native input to `form.register()` against.
 */
export interface DatePickerProps {
  id?: string;
  label: string;
  value?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  /** Restrict selectable calendar days (e.g. `{ after: new Date() }` for a birth date). */
  disabledDates?: Matcher | Matcher[];
  /** Extra classes on the trigger button — e.g. tighter padding/font size to line up its height
   * with a `Button`/`Select` (`h-11`) sitting in the same row (no fixed height by default, since
   * the stacked label+value text sizes itself). */
  className?: string;
}

export function DatePicker({
  id,
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  disabled,
  disabledDates,
  className,
}: DatePickerProps) {
  const locale = useLocale() as Locale;
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;

  return (
    <div className="w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            disabled={disabled}
            onBlur={onBlur}
            className={cn(
              "flex h-11 w-full items-center gap-2 rounded-md border border-input bg-card px-3.5 text-left shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              error && "border-destructive focus-visible:ring-destructive",
            )}
          >
            <span className="sr-only">{label}</span>
            <span className={cn("min-w-0 flex-1 truncate text-sm", selected ? "text-foreground" : "text-muted-foreground")}>
              {selected ? formatDate(selected, locale) : (placeholder ?? label)}
            </span>
            {/* Custom brand-colored glyph — replaces the native date input's own picker icon. */}
            <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto rounded-2xl p-0 shadow-lg">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            disabled={disabledDates}
            onSelect={(date) => {
              if (!date) return;
              onChange(format(date, "yyyy-MM-dd"));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
