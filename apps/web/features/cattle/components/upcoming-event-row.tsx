"use client"; // next-intl translations

import { useLocale, useTranslations } from "next-intl";
import {
  Baby,
  CalendarClock,
  ClipboardCheck,
  ListTodo,
  Milk,
  ShieldCheck,
  Stethoscope,
  Syringe,
  type LucideIcon,
} from "lucide-react";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { cn } from "@/lib/utils";
import type { UpcomingEvent, UpcomingEventKind } from "../types";
import { eventDue, eventLabel, eventVariant } from "../upcoming-events";

/** Shared by the Animals list "Next event" cell + popover (RFE-151) and the animal detail Overview
 * "Upcoming" list (RFE-152), so the same event reads identically in both places. */
export const KIND_ICON: Record<UpcomingEventKind, LucideIcon> = {
  HEALTH_STEP: Stethoscope,
  PREVENTIVE_STEP: Syringe,
  PREGNANCY_CHECK: ClipboardCheck,
  CALVING: Baby,
  DRY_OFF: Milk,
  TASK: ListTodo,
  WITHDRAWAL_END: ShieldCheck,
  WEANING: CalendarClock,
};

/** Text colour per urgency variant — the same red / amber / neutral the chip border uses. */
const DUE_TEXT: Record<string, string> = {
  destructive: "text-destructive",
  warning: "text-warning",
  info: "text-info",
  muted: "text-muted-foreground",
};

/** Translated title, relative-date text and urgency variant of one event. */
export function useEventText(event: UpcomingEvent) {
  const t = useTranslations("cattle");
  const locale = useLocale() as Locale;
  const label = eventLabel(event);
  const due = eventDue(event);
  const parsed = event.dueAt ? new Date(event.dueAt) : null;
  const date = parsed && !isNaN(parsed.getTime()) ? formatDate(parsed, locale) : "";
  return {
    label: t(label.key, label.values),
    due: t(due.key, due.values),
    date,
    variant: eventVariant(event) ?? "muted",
  };
}

export function UpcomingEventRow({ event }: { event: UpcomingEvent }) {
  const t = useTranslations("cattle");
  const text = useEventText(event);
  const Icon = KIND_ICON[event.kind];
  return (
    <li className="flex items-start gap-2.5 px-3 py-2">
      <Icon className={cn("mt-0.5 size-4 shrink-0", DUE_TEXT[text.variant])} aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{text.label}</span>
        <span className={cn("text-xs font-medium", DUE_TEXT[text.variant])}>
          <span>{text.due}</span>
          {text.date ? <span className="opacity-80"> ({text.date})</span> : null}
          {!event.actionable ? <span className="ms-1.5 text-muted-foreground">· {t("upcoming.info")}</span> : null}
        </span>
      </span>
    </li>
  );
}
