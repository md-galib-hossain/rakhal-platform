"use client"; // controlled date chips

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import { addDaysLocalIso } from "@/lib/local-date";

const CHIP = "min-h-11 rounded-lg border px-4 text-sm transition-colors";

/**
 * "When" row of every event form (03 §5.2): Today (default), Yesterday, Pick date (never in the future), and a time of
 * day for the events that record one. A date older than 2 days gets a quiet "Past entry" tag.
 */
export function WhenField({
  date,
  time,
  showTime,
  today,
  onDateChange,
  onTimeChange,
}: {
  date: string;
  time: string;
  showTime: boolean;
  today: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
}) {
  const t = useTranslations("events.form");
  const yesterday = addDaysLocalIso(today, -1);
  const custom = date !== today && date !== yesterday;
  const pastEntry = date < addDaysLocalIso(today, -2);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-foreground">{t("when")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={date === today}
          onClick={() => onDateChange(today)}
          className={cn(CHIP, date === today ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border hover:bg-muted")}
        >
          {t("today")}
        </button>
        <button
          type="button"
          aria-pressed={date === yesterday}
          onClick={() => onDateChange(yesterday)}
          className={cn(CHIP, date === yesterday ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border hover:bg-muted")}
        >
          {t("yesterday")}
        </button>
        <div className={cn("min-w-40", custom && "[&_button]:border-primary")}>
          <DatePicker label={t("pickDate")} value={date} onChange={(value) => value && onDateChange(value)} disabledDates={{ after: new Date(`${today}T00:00:00`) }} />
        </div>
        {showTime ? (
          <input
            type="time"
            aria-label={t("time")}
            value={time}
            onChange={(event) => onTimeChange(event.target.value)}
            className="h-12 rounded-lg border border-input bg-background px-3 text-base text-foreground sm:text-sm"
          />
        ) : null}
      </div>
      {pastEntry ? <p className="text-xs text-muted-foreground">{t("pastEntryTag")}</p> : null}
    </div>
  );
}
