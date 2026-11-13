"use client"; // live queries for each card

import { useState, type ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, HeartPulse } from "lucide-react";
import { Card } from "@rakhal/ui/ui/card";
import { WS_CARD } from "../workspace-grid";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { todayLocalIso } from "@/lib/local-date";
import { useAnimalTimeline } from "@/features/events/hooks/use-animal-timeline";
import { TimelineRow } from "@/features/events/components/timeline/timeline-row";
import { useRecorderNames } from "@/features/events/components/timeline/use-recorder-names";
import type { EventKey } from "@/features/events/types";
import { useCattleHealthSummary, useCattleOverview, useCattleReproductionSummary } from "../../../hooks/use-cattle-detail-tabs";
import type { CattleDetail } from "../../../types";
import { buildPhaseBar, calvingsShown, milkFigures, overviewCards, weightTrend } from "./overview-model";

type DrillTarget = "reproduction" | "milk" | "health" | "growth";

interface Common {
  cattle: CattleDetail;
  canRecord: boolean;
  onRecord: (key: EventKey) => void;
  onView?: () => void;
}

/** Card shell: title row (label + optional view link), equal height inside its grid row. */
function OverviewCard({ title, onView, children, className }: { title: string; onView?: () => void; children: ReactNode; className?: string }) {
  const t = useTranslations("events.workspace.overview");
  return (
    <Card className={cn(WS_CARD, "flex h-full min-w-0 flex-col gap-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {onView ? (
          <button type="button" onClick={onView} className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-sm font-medium text-primary outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring">
            {t("view")}
            <ArrowUpRight className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
      {children}
    </Card>
  );
}

function Empty({ hint, action }: { hint: string; action: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-start justify-center gap-2">
      <p className="text-sm text-muted-foreground">{hint}</p>
      {action}
    </div>
  );
}

/** Seven soft bars for the last week of milk (decorative: the totals sit beside it). */
function Bars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-14 items-end gap-2" aria-hidden>
      {values.map((v, i) => (
        <span key={i} className="flex-1 rounded-sm bg-primary/25" style={{ height: `${Math.max((v / max) * 100, 8)}%` }} />
      ))}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="truncate text-[clamp(1.125rem,1.4vw,1.5rem)] font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function RecordButtons({ keys, onRecord }: { keys: EventKey[]; onRecord: (key: EventKey) => void }) {
  const tCat = useTranslations("events.catalogue");
  return (
    <div className="flex flex-wrap gap-2">
      {keys.map((key) => (
        <Button key={key} type="button" variant="outline" size="sm" className="h-9" onClick={() => onRecord(key)}>
          {tCat(`${key}.label`)}
        </Button>
      ))}
    </div>
  );
}

function PhaseBarCard({ cattle, onRecord, canRecord, onView }: Common) {
  const t = useTranslations("events.workspace.overview.repro");
  const format = useFormatter();
  const query = useCattleReproductionSummary(cattle.id, true);
  const data = query.data;
  const pregnant = cattle.reproductiveStatus === "PREGNANT";
  const bar = data
    ? buildPhaseBar({ today: todayLocalIso(), dim: cattle.dim, lastBreeding: data.lastBreeding, expectedCalvingDate: data.expectedCalvingDate, pregnant })
    : null;
  const date = (iso: string) => format.dateTime(new Date(`${iso}T00:00:00`), { day: "numeric", month: "short" });
  const currentIndex = bar ? Math.max(0, bar.markers.findIndex((m) => !m.recorded)) : 0;
  const [openKey, setOpenKey] = useState<string | null>(null);
  const phase = pregnant ? t("pregnant") : cattle.reproductiveStatus === "OPEN" ? t("open") : null;
  return (
    <OverviewCard title={t("title")} onView={onView}>
      {query.isLoading ? (
        <CardSkeleton lines={2} />
      ) : !bar ? (
        <Empty
          hint={cattle.animalCategory === "HEIFER" ? t("heiferNone") : t("none")}
          action={canRecord ? <RecordButtons keys={["HEAT", "SERVICE"]} onRecord={onRecord} /> : null}
        />
      ) : (
        <>
          <p className="-mt-2 text-sm text-muted-foreground">
            {[
              data?.lastBreeding ? t("lastService", { date: format.dateTime(new Date(`${data.lastBreeding.slice(0, 10)}T00:00:00`), { dateStyle: "medium" }) }) : null,
              t("calvings", { count: calvingsShown(data?.totalCalvings, cattle.dim) }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {phase ? <p className="sr-only">{phase}</p> : null}
          <TooltipProvider delayDuration={100}>
          <ol className="relative flex justify-between pb-1 pt-2" aria-label={t("barLabel")}>
            <span className="absolute left-[10%] right-[10%] top-[18px] h-0.5 bg-border" aria-hidden />
            <span className="absolute left-[10%] top-[18px] h-0.5 bg-primary" style={{ width: `${(currentIndex / Math.max(bar.markers.length - 1, 1)) * 80}%` }} aria-hidden />
            {bar.markers.map((m, i) => (
              <li key={m.key} className="relative z-10 flex w-1/5 min-w-0 flex-col items-center gap-1.5 text-center" aria-current={i === currentIndex ? "step" : undefined}>
                <Tooltip open={openKey === m.key} onOpenChange={(next) => setOpenKey(next ? m.key : null)}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setOpenKey((k) => (k === m.key ? null : m.key))}
                      aria-label={`${t(`phase.${m.key}`)}, ${date(m.date)}`}
                      className="-my-1.5 flex size-8 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className={cn("block rounded-full border-2 border-primary", i === currentIndex ? "size-5 bg-primary ring-4 ring-primary/20" : "size-3", i !== currentIndex && (m.recorded ? "bg-primary" : "bg-card"))} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[16rem] space-y-0.5 px-3 py-2">
                    <p className="text-sm font-semibold">{t(`phase.${m.key}`)} · {format.dateTime(new Date(`${m.date}T00:00:00`), { dateStyle: "medium" })}</p>
                    <p className="text-muted-foreground">{m.fromToday === 0 ? t("tip.today") : m.fromToday < 0 ? t("tip.ago", { days: -m.fromToday }) : t("tip.ahead", { days: m.fromToday })}</p>
                    <p>{t(`tip.${m.key}${m.key === "check" && pregnant ? "Done" : ""}`, { days: m.gap ?? 0, dim: cattle.dim ?? 0 })}</p>
                    {m.recorded ? null : <p className="text-muted-foreground">{t("tip.projected")}</p>}
                  </TooltipContent>
                </Tooltip>
                <span className="w-full truncate text-xs font-medium text-foreground">{t(`phase.${m.key}`)}</span>
                <span className="text-[11px] leading-none text-muted-foreground">{date(m.date)}</span>
              </li>
            ))}
          </ol>
          </TooltipProvider>
          {canRecord && !pregnant ? <RecordButtons keys={["HEAT", "SERVICE"]} onRecord={onRecord} /> : null}
        </>
      )}
    </OverviewCard>
  );
}

function MilkCard({ cattle, onView }: Common) {
  const t = useTranslations("events.workspace.overview.milk");
  const query = useCattleOverview(cattle.id);
  const fig = milkFigures(query.data?.recent_milk_records ?? [], todayLocalIso());
  const dry = cattle.productionStatus === "DRY";
  return (
    <OverviewCard title={t("title")} onView={onView}>
      {query.isLoading ? (
        <CardSkeleton lines={2} />
      ) : !fig.hasData ? (
        <Empty
          hint={dry ? t("dry") : t("none")}
          action={
            dry ? null : (
              <Button asChild variant="outline" size="sm" className="h-9">
                <Link href="/milk">{t("log")}</Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t("today")}</p>
              <p className="text-3xl font-bold tabular-nums">{fig.today != null ? t("litres", { value: Math.round(fig.today * 10) / 10 }) : "—"}</p>
              {fig.today == null ? <p className="text-xs text-muted-foreground">{t("notMilked")}</p> : null}
            </div>
            <div className="min-w-0 text-right">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t("avg7")}</p>
              <p className="text-3xl font-bold tabular-nums">
                {Math.round((fig.weekTotal / 7) * 10) / 10}
                <span className="ml-1 text-sm font-medium text-muted-foreground">{t("perDay")}</span>
              </p>
            </div>
          </div>
          <Bars values={fig.series.slice(-7)} />
          <p className="text-xs text-muted-foreground">{t("weekTotal", { value: Math.round(fig.weekTotal * 10) / 10 })}</p>
        </>
      )}
    </OverviewCard>
  );
}

function HealthCard({ cattle, onRecord, canRecord, onView }: Common) {
  const t = useTranslations("events.workspace.overview.health");
  const format = useFormatter();
  const query = useCattleHealthSummary(cattle.id);
  const data = query.data;
  const open = data?.activeCases ?? [];
  const today = todayLocalIso();
  const active = (data?.activeWithdrawals ?? [])
    .flatMap((w) => [
      w.milkWithdrawalUntil ? { kind: "milk", until: w.milkWithdrawalUntil.slice(0, 10) } : null,
      w.meatWithdrawalUntil ? { kind: "meat", until: w.meatWithdrawalUntil.slice(0, 10) } : null,
    ])
    .filter((w): w is { kind: string; until: string } => w != null && w.until >= today);
  const left = (until: string) => Math.round((Date.parse(until) - Date.parse(today)) / 86_400_000);
  return (
    <OverviewCard title={t("title")} onView={onView}>
      {query.isLoading ? (
        <CardSkeleton lines={2} />
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden>
              <HeartPulse className="size-5" />
            </span>
            <p className="text-base font-semibold">{open.length > 0 ? t("openCases", { count: open.length }) : t("healthy")}</p>
          </div>
          {open[0] ? <p className="truncate text-sm text-muted-foreground">{t("step", { current: open[0].currentStep, total: open[0].totalSteps })}</p> : null}
          {active.map((w, i) => (
            <p key={`${w.kind}${i}`} className="rounded-md bg-warning-tint px-2 py-1 text-sm font-medium text-warning">
              {t(`withdrawal.${w.kind}`, { date: format.dateTime(new Date(`${w.until}T00:00:00`), { day: "numeric", month: "short" }), days: left(w.until) })}
            </p>
          ))}
          {open.length === 0 && active.length === 0 && canRecord ? (
            <Button type="button" variant="outline" size="sm" className="mt-auto h-9 self-start" onClick={() => onRecord("ILLNESS")}>
              {t("report")}
            </Button>
          ) : null}
        </>
      )}
    </OverviewCard>
  );
}

function GrowthCard({ cattle, onRecord, canRecord, onView }: Common) {
  const t = useTranslations("events.workspace.overview.growth");
  const query = useCattleOverview(cattle.id);
  const data = query.data;
  const trend = weightTrend(data?.weight_history ?? [], todayLocalIso());
  const bcs = data?.bcs_records.at(-1)?.score ?? null;
  return (
    <OverviewCard title={t("title")} onView={onView} className="@min-[900px]/ws:col-span-2">
      {query.isLoading ? (
        <CardSkeleton lines={2} />
      ) : data?.last_weight_kg == null ? (
        <Empty hint={t("none")} action={canRecord ? <RecordButtons keys={["WEIGHT"]} onRecord={onRecord} /> : null} />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Figure label={t("weight")} value={t("kg", { value: data.last_weight_kg })} />
            <Figure label={t("change")} value={trend.delta30 != null ? t("delta", { value: trend.delta30 }) : "—"} />
            <Figure label={t("bcs")} value={bcs != null ? String(bcs) : "—"} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="min-w-0 text-sm text-muted-foreground">{trend.series.length >= 2 ? t("trendHint", { count: trend.series.length }) : t("weighAgain")}</p>
            {canRecord ? <RecordButtons keys={["WEIGHT"]} onRecord={onRecord} /> : null}
          </div>
        </>
      )}
    </OverviewCard>
  );
}

function RecentCard({ cattle, canRecord, onRecord, onSeeAll }: Common & { onSeeAll: () => void }) {
  const t = useTranslations("events.workspace.overview.recent");
  const timeline = useAnimalTimeline({ cattleId: cattle.id, group: null, includeVoided: false });
  const recorderName = useRecorderNames();
  const rows = timeline.items.slice(0, 5);
  return (
    <OverviewCard title={t("title")}>
      {timeline.isLoading ? (
        <CardSkeleton lines={3} />
      ) : rows.length === 0 ? (
        <Empty
          hint={t("none")}
          action={
            canRecord ? (
              <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => onRecord("NOTE")}>
                {t("recordFirst")}
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <ol className="divide-y divide-border">
            {rows.map((event) => (
              <TimelineRow key={event.id} event={event} actorName={recorderName(event.recordedById)} />
            ))}
          </ol>
          <button type="button" onClick={onSeeAll} className="min-h-9 self-start rounded-md px-2 text-sm font-medium text-primary hover:bg-primary/10">
            {t("seeAll")}
          </button>
        </>
      )}
    </OverviewCard>
  );
}

/**
 * Overview main column (RFE-180, 06 §5): cards stretch to equal height per row and hide when they do not apply (no
 * reproduction card for a bull or steer, no milk card for a heifer). Next up is the grid's third track, not here.
 */
export function OverviewMain({
  cattle,
  canRecord,
  onRecord,
  onDrill,
  onSeeAll,
}: {
  cattle: CattleDetail;
  canRecord: boolean;
  onRecord: (key: EventKey) => void;
  onDrill: (key: DrillTarget) => void;
  onSeeAll: () => void;
}) {
  const applies = overviewCards(cattle);
  const base = { cattle, canRecord, onRecord };
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-stretch gap-6 @min-[900px]/ws:grid-cols-2">
      {applies.reproduction ? (
        <div className="@min-[900px]/ws:col-span-2">
          <PhaseBarCard {...base} onView={() => onDrill("reproduction")} />
        </div>
      ) : null}
      {applies.milk ? <MilkCard {...base} onView={() => onDrill("milk")} /> : null}
      <div className={cn(!applies.milk && "@min-[900px]/ws:col-span-2")}>
        <HealthCard {...base} onView={() => onDrill("health")} />
      </div>
      <GrowthCard {...base} onView={() => onDrill("growth")} />
      <div className="@min-[900px]/ws:col-span-2">
        <RecentCard {...base} onSeeAll={onSeeAll} />
      </div>
    </div>
  );
}
