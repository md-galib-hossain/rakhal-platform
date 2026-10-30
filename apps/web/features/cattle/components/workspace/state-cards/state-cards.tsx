"use client"; // live queries

import { useFormatter, useTranslations } from "next-intl";
import { useMilkEligibility } from "@/features/milk/hooks/use-milk";
import {
  useCattleHealthSummary,
  useCattleOverview,
  useCattleReproductionSummary,
} from "../../../hooks/use-cattle-detail-tabs";
import type { CattleDetail } from "../../../types";
import { StateCard } from "./state-card";

interface CardProps {
  cattle: CattleDetail;
  onView: () => void;
}

const muted = "text-muted-foreground";

/** Locale date for ICU messages whose word order differs per language (bn puts the date first). */
function useDateLabel() {
  const format = useFormatter();
  return (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium" });
}

export function ReproductionCard({ cattle, onView }: CardProps) {
  const dateLabel = useDateLabel();
  const t = useTranslations("events.cards.reproduction");
  const query = useCattleReproductionSummary(cattle.id, true);
  const data = query.data;
  const pregnant = cattle.reproductiveStatus === "PREGNANT";
  const hasAny = data && (pregnant || data.lastBreeding || data.totalCalvings > 0 || cattle.reproductiveStatus === "OPEN");
  return (
    <StateCard title={t("title")} loading={query.isLoading} error={query.isError} onRetry={() => void query.refetch()} onView={onView}>
      {!data || !hasAny ? (
        <p className={muted}>{t("none")}</p>
      ) : (
        <>
          <p className="font-semibold">
            {pregnant ? (data.daysPregnant != null ? t("pregnantDay", { days: data.daysPregnant }) : t("title")) : cattle.reproductiveStatus === "OPEN" ? t("open") : t("title")}
          </p>
          {pregnant && data.expectedCalvingDate ? (
            <p className={muted}>{t("due", { date: dateLabel(data.expectedCalvingDate) })}</p>
          ) : null}
          {data.lastBreeding ? (
            <p className={muted}>{t("lastService", { date: dateLabel(data.lastBreeding) })}</p>
          ) : null}
          <p className={muted}>{t("calvings", { count: data.totalCalvings })}</p>
        </>
      )}
    </StateCard>
  );
}

export function MilkCard({ cattle, onView }: CardProps) {
  const t = useTranslations("events.cards.milk");
  const tw = useTranslations("events.workspace");
  const query = useCattleOverview(cattle.id);
  const eligibility = useMilkEligibility(cattle.id).data;
  const data = query.data;
  const bars = (data?.recent_milk_records ?? []).slice(-7).map((record) => record.total_l);
  const max = Math.max(1, ...bars);
  const held = eligibility && (eligibility.primaryStatus === "WITHHELD" || eligibility.primaryStatus === "DISCARD_REQUIRED");
  return (
    <StateCard title={t("title")} loading={query.isLoading} error={query.isError} onRetry={() => void query.refetch()} onView={onView}>
      {!data || (data.avg_daily_yield_7d === 0 && bars.length === 0) ? (
        <p className={muted}>{t("noData")}</p>
      ) : (
        <>
          <p className="font-semibold">{t("perDay", { value: Math.round(data.avg_daily_yield_7d * 10) / 10 })}</p>
          {bars.length > 0 ? (
            <div className="flex h-6 items-end gap-0.5" aria-hidden>
              {bars.map((value, index) => (
                <span key={index} className="w-2 rounded-sm bg-primary/60" style={{ height: `${Math.max(8, (value / max) * 100)}%` }} />
              ))}
            </div>
          ) : null}
          {cattle.dim != null ? <p className={muted}>{tw("dim", { days: cattle.dim })}</p> : null}
        </>
      )}
      {held ? <p className="font-medium text-destructive">{t("hold")}</p> : null}
    </StateCard>
  );
}

export function HealthCard({ cattle, onView }: CardProps) {
  const dateLabel = useDateLabel();
  const t = useTranslations("events.cards.health");
  const query = useCattleHealthSummary(cattle.id);
  const data = query.data;
  const milkUntil = latest((data?.activeWithdrawals ?? []).map((w) => w.milkWithdrawalUntil));
  const meatUntil = latest((data?.activeWithdrawals ?? []).map((w) => w.meatWithdrawalUntil));
  const openCases = data?.activeCases.length ?? 0;
  return (
    <StateCard title={t("title")} loading={query.isLoading} error={query.isError} onRetry={() => void query.refetch()} onView={onView}>
      <p className="font-semibold">{openCases > 0 ? t("openCases", { count: openCases }) : t("noCase")}</p>
      {data?.ongoingTreatment ? <p className={muted}>{t("inTreatment")}</p> : null}
      {milkUntil ? (
        <p className="font-medium text-warning">{t("milkWithdrawal", { date: dateLabel(milkUntil) })}</p>
      ) : null}
      {meatUntil ? (
        <p className="font-medium text-warning">{t("meatWithdrawal", { date: dateLabel(meatUntil) })}</p>
      ) : null}
    </StateCard>
  );
}

export function GrowthCard({ cattle, onView }: CardProps) {
  const t = useTranslations("events.cards.growth");
  const query = useCattleOverview(cattle.id);
  const data = query.data;
  const bcs = data?.bcs_records.at(-1)?.score ?? null;
  return (
    <StateCard title={t("title")} loading={query.isLoading} error={query.isError} onRetry={() => void query.refetch()} onView={onView}>
      {data?.last_weight_kg == null && bcs == null ? (
        <p className={muted}>{t("noData")}</p>
      ) : (
        <p className="font-semibold">
          {[data?.last_weight_kg != null ? t("weight", { kg: data.last_weight_kg }) : null, bcs != null ? t("bcs", { score: bcs }) : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
    </StateCard>
  );
}

/** Latest ISO date in the list, ignoring nulls. */
function latest(dates: (string | null)[]): string | null {
  const present = dates.filter((date): date is string => Boolean(date));
  return present.length > 0 ? present.reduce((a, b) => (a > b ? a : b)) : null;
}
