"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import type { Matcher } from "react-day-picker";
import { Calendar } from "@rakhal/ui/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@rakhal/ui/ui/popover";

/**
 * Rakhal-themed replacement for `<input type="date">` — the native control renders the browser's
 * own OS-styled calendar icon and popup (unstyleable, ignores `--card`/`--border`/dark mode, reads
 * broken in dark theme). Built from the app's own `Calendar` (react-day-picker, token-driven) +
 * `Popover`, in the same chrome as `LabeledInput` so it drops into an existing form grid unchanged.
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
  /** Show an inline "clear" affordance + a Clear button in the popover footer (optional fields). */
  clearable?: boolean;
  /** Extra classes on the trigger button. */
  className?: string;
}

/** Shared popover footer for the date/date-time pickers: quick "Today" + optional "Clear". */
export function PickerFooter({
  onToday,
  onClear,
}: {
  onToday: () => void;
  onClear?: () => void;
}) {
  const t = useTranslations("common");
  return (
    <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
      <button
        type="button"
        onClick={onToday}
        className="rounded-md px-2 py-1 text-sm font-medium text-primary transition-colors hover:bg-success-tint"
      >
        {t("today")}
      </button>
      {onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted"
        >
          {t("clear")}
        </button>
      ) : null}
    </div>
  );
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
  clearable,
  className,
}: DatePickerProps) {
  const locale = useLocale() as Locale;
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;

  return (
    <div className="w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <div className="relative w-full">
          <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            disabled={disabled}
            onBlur={onBlur}
            className={cn(
              "flex min-h-[56px] w-full items-center justify-between gap-2 rounded-xl border border-input bg-card px-4 py-2 text-left shadow-xs transition-colors hover:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              clearable && selected && !disabled && "pr-16",
              error && "border-destructive focus-visible:ring-destructive",
              className,
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col justify-center">
              <span className="text-xs text-muted-foreground select-none">{label}</span>
              <span className={cn("truncate text-sm", selected ? "text-foreground" : "text-muted-foreground")}>
                {selected ? formatDate(selected, locale) : (placeholder ?? "—")}
              </span>
            </div>
            {/* Custom brand-colored glyph — replaces the native date input's own picker icon. */}
            <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden />
          </button>
          </PopoverTrigger>
          {clearable && selected && !disabled ? (
            // Sibling of the trigger, not a child: a <button> can't legally nest inside another one,
            // and a click-handling <span> is a keyboard trap the a11y lint (rightly) rejects.
            <button
              type="button"
              aria-label="Clear date"
              onClick={() => onChange("")}
              className="absolute right-9 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
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
          <PickerFooter
            onToday={() => {
              onChange(format(new Date(), "yyyy-MM-dd"));
              setOpen(false);
            }}
            onClear={
              clearable
                ? () => {
                    onChange("");
                    setOpen(false);
                  }
                : undefined
            }
          />
        </PopoverContent>
      </Popover>
      {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
