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
import { Button } from "@rakhal/ui/ui/button";
import { recordKeyFor } from "@/features/events/next-up-model";
import type { EventKey } from "@/features/events/types";
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

export function UpcomingEventRow({
  event,
  detailed = false,
  onRecord,
}: {
  event: UpcomingEvent;
  detailed?: boolean;
  /** RFE-160 — shows a Record button on rows that map to an event form. */
  onRecord?: (key: EventKey) => void;
}) {
  const t = useTranslations("cattle");
  const tNext = useTranslations("events.nextUp");
  const recordKey = onRecord ? recordKeyFor(event) : null;
  const text = useEventText(event);
  const Icon = KIND_ICON[event.kind];
  const kindLabel = t(`upcoming.kinds.${event.kind}`);

  if (detailed) {
    return (
      <li className="flex items-start gap-3 px-3.5 py-2.5 transition-colors hover:bg-muted/30">
        <div
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border",
            {
              "border-destructive/30 bg-destructive/10 text-destructive": text.variant === "destructive",
              "border-warning/30 bg-warning/10 text-warning": text.variant === "warning",
              "border-info/30 bg-info/10 text-info": text.variant === "info",
              "border-border bg-muted/60 text-muted-foreground": text.variant === "muted",
            },
          )}
        >
          <Icon className="size-4 shrink-0" aria-hidden />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-semibold leading-snug text-foreground break-words">
              {text.label}
            </span>
            {!event.actionable ? (
              <span className="shrink-0 text-xs font-medium text-muted-foreground">· {t("upcoming.info")}</span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <span className={cn("font-medium", DUE_TEXT[text.variant])}>
              <span>{text.due}</span>
              {text.date ? <span className="text-muted-foreground font-normal"> ({text.date})</span> : null}
            </span>
            {kindLabel && kindLabel !== text.label ? (
              <span className="text-muted-foreground/80">· {kindLabel}</span>
            ) : null}
          </div>
        </div>
        {recordKey && onRecord ? (
          <Button type="button" size="sm" variant="outline" className="h-9 shrink-0" onClick={() => onRecord(recordKey)}>
            {tNext("recordOnList")}
          </Button>
        ) : null}
      </li>
    );
  }

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
