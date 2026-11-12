"use client"; // reads the animal's timeline

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { DateText } from "@/components/shared/date-text";
import type { CattleDetail } from "@/features/cattle/types";
import { useAnimalTimeline } from "../../hooks/use-animal-timeline";

const DAY_MS = 86_400_000;
const STRIP_STATUSES = ["pregnant", "open", "milking", "dry", "fresh"];

function daysAgo(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS));
}

export interface CowContext {
  lastHeatAt: string | null;
  lastBreedingAt: string | null;
  services: number;
}

/** Latest heat / AI and the services since the last calving, from the animal's timeline rows. */
export function summariseContext(items: { type: string; eventAt: string }[]): CowContext {
  const sorted = [...items].sort((a, b) => (a.eventAt < b.eventAt ? 1 : -1));
  const lastCalving = sorted.find((row) => row.type === "CALVING")?.eventAt ?? "";
  return {
    lastHeatAt: sorted.find((row) => row.type === "HEAT")?.eventAt ?? null,
    lastBreedingAt: sorted.find((row) => row.type === "BREEDING")?.eventAt ?? null,
    services: sorted.filter((row) => row.type === "BREEDING" && row.eventAt > lastCalving).length,
  };
}

/** The context a farmer needs while recording: last heat, last AI, days in milk, services this lactation, status. */
export function EventContextCard({
  cattle,
  compact = false,
  strip = false,
}: {
  cattle: CattleDetail;
  compact?: boolean;
  /** RFE-179: the one-line strip at the top of the event drawer. */
  strip?: boolean;
}) {
  const t = useTranslations("events.form.context");
  const tChip = useTranslations("events.chip");
  const timeline = useAnimalTimeline({ cattleId: cattle.id, group: null, includeVoided: false });
  const context = useMemo(() => summariseContext(timeline.items), [timeline.items]);

  const row = (label: string, iso: string | null) => (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums text-foreground">
        {iso ? (
          <>
            <DateText date={iso} /> <span className="text-muted-foreground">({t("daysAgo", { count: daysAgo(iso) })})</span>
          </>
        ) : (
          "—"
        )}
      </dd>
    </div>
  );

  if (strip) {
    const status = (cattle.reproductiveStatus ?? cattle.herdStatus ?? "").toLowerCase();
    const statusLabel = STRIP_STATUSES.includes(status) ? tChip(status as never) : null;
    const ago = (iso: string | null) => (iso ? t("daysAgo", { count: daysAgo(iso) }) : "—");
    return (
      <p
        aria-label={t("title")}
        className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-border bg-muted/40 px-6 py-2 text-xs text-muted-foreground"
      >
        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary" aria-hidden>
          {(cattle.name ?? cattle.tagNumber).slice(0, 1).toUpperCase()}
        </span>
        <span className="font-semibold text-foreground">{cattle.name ?? cattle.tagNumber}</span>
        {cattle.name ? <span>#{cattle.tagNumber}</span> : null}
        {statusLabel ? <span>· {statusLabel}</span> : null}
        <span>· {t("dim")} {cattle.dim ?? "—"}</span>
        <span>· {t("lastHeat")} {ago(context.lastHeatAt)}</span>
        <span>· {t("lastAi")} {ago(context.lastBreedingAt)}</span>
      </p>
    );
  }

  if (compact) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("lastHeat")}: {context.lastHeatAt ? t("daysAgo", { count: daysAgo(context.lastHeatAt) }) : "—"} · {t("lastAi")}:{" "}
        {context.lastBreedingAt ? t("daysAgo", { count: daysAgo(context.lastBreedingAt) }) : "—"} · {t("dim")} {cattle.dim ?? "—"} ·{" "}
        {t("services")} {context.services}
      </p>
    );
  }

  return (
    <section aria-label={t("title")} className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("title")}</h4>
      <dl className="flex flex-col gap-1.5">
        {row(t("lastHeat"), context.lastHeatAt)}
        {row(t("lastAi"), context.lastBreedingAt)}
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <dt className="text-muted-foreground">{t("dim")}</dt>
          <dd className="font-medium tabular-nums text-foreground">{cattle.dim ?? "—"}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <dt className="text-muted-foreground">{t("services")}</dt>
          <dd className="font-medium tabular-nums text-foreground">{context.services}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <dt className="text-muted-foreground">{t("status")}</dt>
          <dd className="font-medium text-foreground">{cattle.reproductiveStatus ?? cattle.herdStatus ?? "—"}</dd>
        </div>
      </dl>
    </section>
  );
}
