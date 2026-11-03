"use client"; // locale-aware text and dates

import type { ReactNode } from "react";
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
import { TYPE_GROUP, type TimelineEvent, type TimelineEventType, type TimelineGroup } from "../../timeline-model";
import { formatEventSummary, safeText } from "../../forms/summary";

/** Group tint (06 §6): a soft token fill with the group colour on the icon. Never colour alone: the type title sits next to it. */
const GROUP_TINT: Record<TimelineGroup, string> = {
  REPRODUCTION: "bg-accent-pink-tint text-accent-pink",
  HEALTH: "bg-destructive-tint text-destructive",
  GROWTH: "bg-accent-teal-tint text-accent-teal",
  MOVEMENT: "bg-muted text-muted-foreground",
  OTHER: "bg-muted text-muted-foreground",
};

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

/**
 * One timeline row (RFE-155, redesigned RFE-178, 06 §6): a group-tinted icon, the title with a one-line summary from
 * `formatEventSummary` (never an id or raw code), the notes, and a meta column with the time and the recorder's first
 * name. Provenance cues stay: a "History" tag for entries recorded after the fact, a struck-through row for voided ones,
 * and a quiet line when the event follows from an earlier one. Compact: one line plus notes.
 */
export function TimelineRow({ event, actions, actorName }: { event: TimelineEvent; actions?: ReactNode; actorName?: string | null }) {
  const t = useTranslations("events.timeline");
  const tSummary = useTranslations("events.timeline.summary");
  const tOptions = useTranslations("events.options");
  const tCondition = useTranslations("health.reportSickness.conditionValue");
  const Icon = ICONS[event.type] ?? StickyNote;
  const voided = event.status === "VOIDED";

  const summary = formatEventSummary(event, {
    t: (key, values) => tSummary(key as never, values as never),
    option: (group, value) => (typeof value === "string" && tOptions.has(`${group}.${value}` as never) ? tOptions(`${group}.${value}` as never) : null),
    condition: (value) => (typeof value === "string" && tCondition.has(value as never) ? tCondition(value as never) : null),
  });
  const customName = event.type === "CUSTOM" ? safeText(event.detail?.name) : null;
  const title = customName ?? t(`type.${event.type}`);
  const warnings = Array.isArray(event.findings) ? event.findings.length : 0;
  const actorFull = safeText(actorName);
  const actor = actorFull ? actorFull.split(/\s+/).map((p) => p.charAt(0)).join("").slice(0, 2).toUpperCase() : null;
  const tint = GROUP_TINT[TYPE_GROUP[event.type]] ?? GROUP_TINT.OTHER;
  const strike = voided && "line-through";

  return (
    <li className={cn("flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted/50 focus-within:bg-muted/50", voided && "opacity-60")}>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", tint)} aria-hidden>
        <Icon className="size-[18px]" strokeWidth={1.75} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5" title={summary ? `${title} · ${summary}` : title}>
          <span className={cn("text-sm font-semibold text-foreground", strike)}>{title}</span>
          {event.provenance === "HISTORICAL" ? <Chip variant="info">{t("history")}</Chip> : null}
          {voided ? <Chip variant="muted">{t("voided")}</Chip> : null}
          {warnings > 0 ? (
            <Chip variant="warning" title={t("warningHint")}>
              {t("warning")}
            </Chip>
          ) : null}
        </div>
        {summary && summary !== title ? (
          <p className={cn("min-w-0 break-words text-sm text-muted-foreground", strike)}>{summary}</p>
        ) : null}
        {event.notes ? <p className={cn("text-sm italic text-muted-foreground/80", strike)}>{event.notes}</p> : null}
        {event.sourceEventId ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <CornerDownRight className="size-3.5 shrink-0" aria-hidden />
            {t("linked")}
          </p>
        ) : null}
      </div>
      {event.provenance === "RECORDED" || actor ? (
        <div className="flex max-w-24 shrink-0 flex-col items-end pt-0.5 text-xs text-muted-foreground">
          {event.provenance === "RECORDED" ? (
            <DateText date={event.eventAt} options={{ hour: "2-digit", minute: "2-digit" }} className="tabular-nums" />
          ) : null}
          {actor ? (
            <span className="max-w-full truncate" title={actorFull ?? undefined}>
              {actor}
            </span>
          ) : null}
        </div>
      ) : null}
      {actions}
    </li>
  );
}
