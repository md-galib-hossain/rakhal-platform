"use client";

import { useMemo, useState } from "react";
import { format, isValid, parseISO, setHours, setMinutes } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { CalendarClock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import type { Matcher } from "react-day-picker";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Button } from "./button";

/**
 * Rakhal-themed replacement for `<input type="datetime-local">`. The native control renders the
 * browser's own date+time panel (the blue Chromium calendar + spinner columns in the reported
 * Record Breeding/AI screenshot) — it ignores every design token, can't be sized, and looks like a
 * different product inside a Rakhal dialog. This is the same `Calendar` + `Popover` chrome as
 * `DatePicker`, with a themed 12-hour time column beside the grid.
 *
 * `value`/`onChange` are `"yyyy-MM-dd'T'HH:mm"` strings — exactly what `<input type="datetime-local">`
 * produced — so every existing zod field and API payload keeps working; only the `register()` call
 * becomes a `Controller`.
 */
export interface DateTimePickerProps {
  id?: string;
  label: string;
  value?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  disabledDates?: Matcher | Matcher[];
  /** Minute granularity offered in the time column (default 5). */
  minuteStep?: number;
  clearable?: boolean;
  className?: string;
}

const VALUE_FORMAT = "yyyy-MM-dd'T'HH:mm";

function parseValue(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : undefined;
}

const columnClass =
  "flex max-h-56 w-14 flex-col gap-0.5 overflow-y-auto scroll-smooth px-1 [scrollbar-width:thin]";

function TimeCell({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-md py-1.5 text-center text-sm transition-colors",
        active ? "bg-primary font-semibold text-white" : "text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

export function DateTimePicker({
  id,
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  disabled,
  disabledDates,
  minuteStep = 5,
  clearable,
  className,
}: DateTimePickerProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const selected = parseValue(value);
  /** Editing time before a day is picked is meaningless, so an empty field starts from "now". */
  const draft = selected ?? new Date();

  const minutes = useMemo(() => {
    const list: number[] = [];
    for (let m = 0; m < 60; m += minuteStep) list.push(m);
    if (selected && !list.includes(selected.getMinutes())) {
      list.push(selected.getMinutes());
      list.sort((a, b) => a - b);
    }
    return list;
  }, [minuteStep, selected]);

  const commit = (next: Date) => onChange(format(next, VALUE_FORMAT));

  const hour24 = draft.getHours();
  const isPm = hour24 >= 12;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  const setHour12 = (h: number) => commit(setHours(draft, (h % 12) + (isPm ? 12 : 0)));
  const setMeridiem = (pm: boolean) => commit(setHours(draft, (hour24 % 12) + (pm ? 12 : 0)));

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
              "flex h-11 w-full items-center gap-2 rounded-md border border-input bg-card px-3.5 text-left shadow-xs transition-colors hover:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              clearable && selected && !disabled && "pr-16",
              error && "border-destructive focus-visible:ring-destructive",
              className,
            )}
          >
            <span className="sr-only">{label}</span>
            <span className={cn("min-w-0 flex-1 truncate text-sm", selected ? "text-foreground" : "text-muted-foreground")}>
              {selected
                ? `${formatDate(selected, locale)} · ${format(selected, "h:mm a")}`
                : (placeholder ?? label)}
            </span>
            <CalendarClock className="size-4 shrink-0 text-primary" aria-hidden />
          </button>
          </PopoverTrigger>
          {clearable && selected && !disabled ? (
            // Sibling of the trigger, not a child: a <button> can't legally nest inside another one,
            // and a click-handling <span> is a keyboard trap the a11y lint (rightly) rejects.
            <button
              type="button"
              aria-label="Clear date and time"
              onClick={() => onChange("")}
              className="absolute right-9 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
        <PopoverContent align="start" className="w-auto rounded-2xl p-0 shadow-lg">
          <div className="flex">
            <Calendar
              mode="single"
              selected={selected}
              defaultMonth={selected}
              disabled={disabledDates}
              onSelect={(date) => {
                if (!date) return;
                // Keep whatever time is already chosen — picking a day must not reset it.
                commit(setMinutes(setHours(date, draft.getHours()), draft.getMinutes()));
              }}
            />
            <div className="flex flex-col border-l border-border py-3">
              <span className="px-3 pb-2 text-xs font-medium text-muted-foreground">{t("time")}</span>
              <div className="flex gap-1 px-2">
                <div className={columnClass} role="listbox" aria-label={t("hour")}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                    <TimeCell key={h} active={selected != null && hour12 === h} onClick={() => setHour12(h)}>
                      {String(h).padStart(2, "0")}
                    </TimeCell>
                  ))}
                </div>
                <div className={columnClass} role="listbox" aria-label={t("minute")}>
                  {minutes.map((m) => (
                    <TimeCell
                      key={m}
                      active={selected != null && draft.getMinutes() === m}
                      onClick={() => commit(setMinutes(draft, m))}
                    >
                      {String(m).padStart(2, "0")}
                    </TimeCell>
                  ))}
                </div>
                <div className="flex w-14 flex-col gap-0.5 px-1">
                  <TimeCell active={selected != null && !isPm} onClick={() => setMeridiem(false)}>
                    AM
                  </TimeCell>
                  <TimeCell active={selected != null && isPm} onClick={() => setMeridiem(true)}>
                    PM
                  </TimeCell>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => commit(new Date())}
                className="rounded-md px-2 py-1 text-sm font-medium text-primary transition-colors hover:bg-success-tint"
              >
                {t("now")}
              </button>
              {clearable ? (
                <button
                  type="button"
                  onClick={() => onChange("")}
                  className="rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted"
                >
                  {t("clear")}
                </button>
              ) : null}
            </div>
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              {t("done")}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
