"use client"; // reads the active locale to format the preview dates

import { useLocale, useTranslations } from "next-intl";
import { Bell, CalendarDays, Milk } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { buildProtocolPreview, type PreviewRow } from "../protocol-preview";
import type { HealthPlanStep } from "../types";

const SHORT_DATE: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };

function useDateFormatter() {
  const locale = useLocale() as Locale;
  return (date: Date, withYear = false) => formatDate(date, locale, withYear ? { day: "numeric", month: "short", year: "numeric" } : SHORT_DATE);
}

/** The three facts a farmer wants before starting a protocol (EPIC D8): when it runs, when milk / meat is safe again,
 * and when the app will remind them. Used compact under the picker and as the head of the full timeline. */
export function ProtocolPreviewSummary({ steps, startDate, className }: { steps: HealthPlanStep[]; startDate: string; className?: string }) {
  const t = useTranslations("health.healthPlan.preview");
  const fmt = useDateFormatter();
  const preview = buildProtocolPreview(steps, startDate);
  if (!preview.firstDate || !preview.lastDate) return null;

  const upcoming = preview.firstStepReminders.filter((slot) => slot.willFire);
  const dates = upcoming.map((slot) => fmt(slot.date)).join(", ");
  const reminderText =
    upcoming.length === 0 ? t("remindersNone") : upcoming.length === preview.firstStepReminders.length ? t("remindersAll", { dates }) : t("remindersPartial", { dates });

  return (
    <div className={cn("flex flex-col gap-2 rounded-lg bg-muted/60 p-3 text-xs", className)}>
      <p className="flex items-start gap-2 text-foreground">
        <CalendarDays className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
        <span>
          {t("span", { steps: preview.rows.length, days: preview.totalDays })} · {fmt(preview.firstDate)} → {fmt(preview.lastDate, true)}
        </span>
      </p>
      {preview.withdrawal.milkUntil || preview.withdrawal.meatUntil ? (
        <p className="flex items-start gap-2 text-warning">
          <Milk className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            {[
              preview.withdrawal.milkUntil ? t("milkUntil", { date: fmt(preview.withdrawal.milkUntil, true) }) : null,
              preview.withdrawal.meatUntil ? t("meatUntil", { date: fmt(preview.withdrawal.meatUntil, true) }) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </p>
      ) : null}
      <p className="flex items-start gap-2 text-muted-foreground">
        <Bell className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>{reminderText}</span>
      </p>
    </div>
  );
}

function relativeLabel(t: ReturnType<typeof useTranslations>, days: number): string {
  if (days === 0) return t("today");
  if (days === 1) return t("tomorrow");
  if (days > 1) return t("inDays", { days });
  return t("daysAgo", { days: -days });
}

function RowItem({ row, last, fmt }: { row: PreviewRow; last: boolean; fmt: (d: Date, y?: boolean) => string }) {
  const t = useTranslations("health.healthPlan.preview");
  const { step } = row;
  const dose = step.doseAmount != null ? `${step.doseAmount} ${step.doseUnit ?? ""}`.trim() : null;
  const detail = [step.medicineName, dose, step.route].filter(Boolean).join(" · ");
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {last ? null : <span className="absolute left-[7px] top-4 h-full w-px bg-border" aria-hidden />}
      <span className={cn("mt-1 size-[15px] shrink-0 rounded-full border-2 bg-card", row.daysFromToday === 0 ? "border-primary" : "border-border")} aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-foreground">{t("dayDate", { day: step.dayNumber, date: fmt(row.date) })}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{relativeLabel(t, row.daysFromToday)}</span>
        </div>
        <p className="truncate text-sm text-foreground">{step.instruction || step.title}</p>
        {detail ? <p className="truncate text-xs text-muted-foreground">{detail}</p> : null}
      </div>
    </li>
  );
}

/** Day-by-day schedule with the real calendar dates the steps will be created on (the backend rule, mirrored in
 * `protocol-preview.ts`), so the preview and the Schedule tab agree. */
export function ProtocolPreviewTimeline({ steps, startDate }: { steps: HealthPlanStep[]; startDate: string }) {
  const fmt = useDateFormatter();
  const preview = buildProtocolPreview(steps, startDate);
  return (
    <div className="flex flex-col gap-4">
      <ProtocolPreviewSummary steps={steps} startDate={startDate} />
      <ol className="flex flex-col px-1">
        {preview.rows.map((row, index) => (
          <RowItem key={row.step.id} row={row} last={index === preview.rows.length - 1} fmt={fmt} />
        ))}
      </ol>
    </div>
  );
}
