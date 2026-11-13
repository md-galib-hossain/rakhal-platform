"use client"; // live query + URL-synced navigation (the sick / withheld tiles open that Sick Bay view)

import { useLocale, useTranslations } from "next-intl";
import { parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";
import { Activity, CalendarClock, ShieldAlert, ShieldCheck, Syringe } from "lucide-react";
import { Card } from "@rakhal/ui/ui/card";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { useHealthDashboard, useRounds } from "../hooks/use-health";
import { HEALTH_MANAGEMENT_TABS, SICK_BAY_VIEWS, type HealthManagementTab, type SickBayView } from "../types";

const TAB_KEYS = HEALTH_MANAGEMENT_TABS as unknown as [HealthManagementTab, ...HealthManagementTab[]];
const VIEW_KEYS = SICK_BAY_VIEWS as unknown as [SickBayView, ...SickBayView[]];

function HighlightTile({
  icon,
  iconBg,
  label,
  value,
  footnote,
  onClick,
  tone,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: React.ReactNode;
  footnote?: React.ReactNode;
  onClick?: () => void;
  tone?: "warning" | "destructive";
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-1 flex-col justify-between gap-2 rounded-xl border border-border bg-card p-3 text-left sm:gap-3 last:odd:col-span-2 sm:last:odd:col-span-1",
        onClick &&
          "cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", iconBg)}>{icon}</span>
        <p className="min-w-0 truncate text-sm font-medium text-foreground">{label}</p>
      </div>
      <div className="flex flex-col gap-1">
        <p
          className={cn(
            "text-xl font-bold text-foreground sm:text-2xl",
            tone === "warning" && "text-warning",
            tone === "destructive" && "text-destructive",
          )}
        >
          {value}
        </p>
        {footnote ? <p className="line-clamp-2 text-xs text-muted-foreground">{footnote}</p> : null}
      </div>
    </Wrapper>
  );
}

/**
 * Healthcare Highlights KPI section (matching Animal Highlights visual language) —
 * 5-tile summary at the top of Healthcare: animals sick now, herd healthy share, animals with
 * milk/meat withheld, late protocol steps, and all-time medicine expense.
 * The Sick, Withheld, and Late steps tiles are clickable filters.
 */
export function HealthStatStrip() {
  const t = useTranslations("health.stat");
  const locale = useLocale() as Locale;
  const query = useHealthDashboard();
  const [, setParams] = useQueryStates({
    healthTab: parseAsStringEnum<HealthManagementTab>(TAB_KEYS),
    // `bay`, not `view`: the global animal-details modal owns `?view=<animalId>`, so `view=withheld` opened it on an animal called "withheld".
    bay: parseAsStringEnum<SickBayView>(VIEW_KEYS),
    status: parseAsString,
  });
  // The same cached Running list the Protocols tab reads. "Late" = steps past their farm day; the tile adds them up across
  // rounds and opens Protocols -> Applied on Needs action, so the number and the list it opens agree.
  const rounds = useRounds({ status: "RUNNING" });
  const lateRounds = (rounds.data?.items ?? []).filter((round) => round.stepsOverdue > 0);
  const lateSteps = lateRounds.reduce((sum, round) => sum + round.stepsOverdue, 0);

  const open = (bay: SickBayView) => void setParams({ healthTab: "treatments", bay });

  return (
    <Card className="flex flex-col gap-4 rounded-2xl border-border p-4 shadow-card">
      <p className="text-xl font-medium text-foreground">{t("title")}</p>

      {query.isLoading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[96px] flex-1 rounded-xl" />
          ))}
        </div>
      ) : query.isError || !query.data ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <span>{t("error")}</span>
          <button type="button" onClick={() => void query.refetch()} className="font-medium text-primary hover:underline">
            {t("retry")}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-5">
          <HighlightTile
            icon={<Activity className="size-4 text-destructive" aria-hidden />}
            iconBg="bg-destructive-tint"
            label={t("sick")}
            value={query.data.sickBayCount}
            footnote={t("sickCaption")}
            onClick={() => open("cases")}
          />
          <HighlightTile
            icon={<ShieldCheck className="size-4 text-success" aria-hidden />}
            iconBg="bg-success-tint"
            label={t("healthy")}
            value={`${query.data.herdHealthScore}%`}
            footnote={t("healthyCaption", {
              healthy: query.data.healthyAnimalCount,
              total: query.data.totalAnimalCount,
            })}
          />
          <HighlightTile
            icon={
              <ShieldAlert
                className={cn("size-4", query.data.safetyWithdrawalCount > 0 ? "text-warning" : "text-warning")}
                aria-hidden
              />
            }
            iconBg="bg-warning-tint"
            label={t("withheld")}
            value={query.data.safetyWithdrawalCount}
            footnote={t("withheldCaption")}
            tone={query.data.safetyWithdrawalCount > 0 ? "warning" : undefined}
            onClick={() => open("withheld")}
          />
          <HighlightTile
            icon={
              <CalendarClock
                className={cn("size-4", lateSteps > 0 ? "text-warning" : "text-accent-indigo")}
                aria-hidden
              />
            }
            iconBg={lateSteps > 0 ? "bg-warning-tint" : "bg-accent-indigo-tint"}
            label={t("late")}
            value={rounds.isSuccess ? lateSteps : "—"}
            footnote={
              rounds.isSuccess
                ? lateSteps > 0
                  ? t("lateCaption", { count: lateRounds.length })
                  : t("lateNone")
                : undefined
            }
            tone={lateSteps > 0 ? "warning" : undefined}
            onClick={() => void setParams({ healthTab: "protocols", status: "needs" })}
          />
          <HighlightTile
            icon={<Syringe className="size-4 text-info" aria-hidden />}
            iconBg="bg-info-tint"
            label={t("medicine")}
            value={formatMoney(query.data.medicineExpense, locale)}
            footnote={t("medicineCaption")}
          />
        </div>
      )}
    </Card>
  );
}
