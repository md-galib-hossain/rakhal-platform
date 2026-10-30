"use client"; // locale-aware text and dates

import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  Baby,
  Banknote,
  Gauge,
  Heart,
  Milk,
  PauseCircle,
  Pill,
  Scale,
  Scissors,
  Skull,
  StickyNote,
  Stethoscope,
  Syringe,
  TrendingDown,
  TrendingUp,
  ArrowLeftRight,
  XCircle,
  CornerDownRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/ui/chip";
import { DateText } from "@/components/shared/date-text";
import type { TimelineEvent, TimelineEventType } from "../../timeline-model";

const ICONS: Record<TimelineEventType, LucideIcon> = {
  HEAT: Heart,
  BREEDING: Syringe,
  PREG_CHECK: Stethoscope,
  CALVING: Baby,
  ABORTION: AlertTriangle,
  DRY_OFF: PauseCircle,
  ILLNESS: Stethoscope,
  TREATMENT: Pill,
  VACCINATION: Syringe,
  DEWORMING: Pill,
  WEIGHT: Scale,
  BCS: Gauge,
  WEANING: Milk,
  CASTRATION: Scissors,
  ENTER_FATTENING: TrendingUp,
  LEAVE_FATTENING: TrendingDown,
  MOVE: ArrowLeftRight,
  SOLD: Banknote,
  DIED: Skull,
  CULLED: XCircle,
  NOTE: StickyNote,
  HOOF_TRIM: Scissors,
  DEHORN: Scissors,
  CUSTOM: StickyNote,
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * One timeline row (RFE-155, 03 §3.4): icon, title, one summary line, the notes, and the provenance cues — a
 * "History" tag for entries recorded after the fact, a struck-through row for voided ones, and a quiet line when the
 * event follows from an earlier one. Sorted by event date by the caller. No row actions yet (edit / void is RFE-161).
 */
export function TimelineRow({ event }: { event: TimelineEvent }) {
  const t = useTranslations("events.timeline");
  const tCondition = useTranslations("health.reportSickness.conditionValue");
  const Icon = ICONS[event.type] ?? StickyNote;
  const voided = event.status === "VOIDED";
  const detail = event.detail ?? {};

  const weight = typeof detail.weightKg === "number" ? t("summary.weight", { kg: detail.weightKg }) : null;
  const score = typeof detail.score === "number" ? t("summary.bcs", { score: detail.score }) : null;
  const condition = text(detail.condition);
  const summary =
    weight ??
    score ??
    text(detail.medicineName) ??
    text(detail.name) ??
    (condition ? tCondition(condition as never) : null);
  const warnings = Array.isArray(event.findings) ? event.findings.length : 0;
  const title = event.type === "CUSTOM" && text(detail.name) ? (text(detail.name) as string) : t(`type.${event.type}`);

  return (
    <li className={cn("flex gap-3 py-3", voided && "opacity-60")}>
      <span
        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground"
        aria-hidden
      >
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn("text-sm font-semibold text-foreground", voided && "line-through")}>{title}</span>
          {summary && summary !== title ? (
            <span className={cn("text-sm text-muted-foreground", voided && "line-through")}>{summary}</span>
          ) : null}
          {event.provenance === "HISTORICAL" ? <Chip variant="info">{t("history")}</Chip> : null}
          {voided ? <Chip variant="muted">{t("voided")}</Chip> : null}
          {warnings > 0 ? (
            <Chip variant="warning" title={t("warningHint")}>
              {t("warning")}
            </Chip>
          ) : null}
        </div>
        {event.notes ? <p className={cn("text-sm text-muted-foreground", voided && "line-through")}>{event.notes}</p> : null}
        {event.sourceEventId ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <CornerDownRight className="size-3.5 shrink-0" aria-hidden />
            {t("linked")}
          </p>
        ) : null}
      </div>
      {event.provenance === "RECORDED" ? (
        <DateText
          date={event.eventAt}
          options={{ hour: "2-digit", minute: "2-digit" }}
          className="shrink-0 pt-1 text-xs text-muted-foreground"
        />
      ) : null}
    </li>
  );
}
