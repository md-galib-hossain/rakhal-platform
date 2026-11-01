"use client"; // popovers + mutations

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { todayLocalIso } from "@/lib/local-date";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { UpcomingEvent } from "@/features/cattle/types";
import { useNextUpActions } from "../../hooks/use-next-up";
import { SNOOZE_DAYS, snoozeDay, snoozeDueAt } from "../../next-up-model";

/** Snooze (1 / 3 / 7 days or a picked date) for a Task Hub reminder; the task keeps its time of day. */
export function SnoozeControl({ event }: { event: UpcomingEvent }) {
  const t = useTranslations("events.nextUp");
  const format = useFormatter();
  const { snooze } = useNextUpActions();
  const [open, setOpen] = useState(false);
  const today = todayLocalIso();

  async function snoozeTo(day: string) {
    try {
      await snooze.mutateAsync({ taskId: event.ref.id, dueAt: snoozeDueAt(event.dueAt, day) });
      toast.success(t("snoozedToast", { date: format.dateTime(new Date(`${day}T00:00:00`), { dateStyle: "medium" }) }));
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("failed"));
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-11 w-full sm:h-9">
          {t("snooze")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-64 flex-col gap-2 p-3">
        {SNOOZE_DAYS.map((days) => (
          <Button key={days} type="button" variant="ghost" className="h-11 justify-start" disabled={snooze.isPending} onClick={() => void snoozeTo(snoozeDay(today, days))}>
            {t(`snoozeDays.${days}`)}
          </Button>
        ))}
        <DatePicker
          label={t("pickDate")}
          onChange={(day) => day && void snoozeTo(day)}
          disabledDates={{ before: new Date(`${snoozeDay(today, 1)}T00:00:00`) }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Skip a Task Hub reminder, with an optional reason that is saved as the cancellation note. */
export function SkipControl({ event }: { event: UpcomingEvent }) {
  const t = useTranslations("events.nextUp");
  const { skip } = useNextUpActions();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  async function confirm() {
    try {
      await skip.mutateAsync({ taskId: event.ref.id, reason: reason.trim() || undefined });
      toast.success(t("skippedToast"));
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("failed"));
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-11 w-full sm:h-9">
          {t("skip")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-72 flex-col gap-2 p-3">
        <label htmlFor={`skip-reason-${event.ref.id}`} className="text-sm font-medium text-foreground">
          {t("skipReason")}
        </label>
        <textarea
          id={`skip-reason-${event.ref.id}`}
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
        />
        <Button type="button" className="h-11" disabled={skip.isPending} onClick={() => void confirm()}>
          {t("skipConfirm")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
