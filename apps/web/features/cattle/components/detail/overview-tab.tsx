"use client"; // live queries

import { useTranslations } from "next-intl";
import { AlertTriangle, Check, ClipboardList, Skull } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { DateText } from "@/components/shared/date-text";
import { Card } from "@/components/ui/card";
import { useCalfDetail } from "@/features/calves/hooks/use-calves";
import { OverviewTab as CalfOverviewTab } from "@/features/calves/components/detail/overview-tab";
import { useTaskPagedList } from "@/features/tasks/hooks/use-tasks";
import { useCattleHealthSummary, useCattleOverview } from "../../hooks/use-cattle-detail-tabs";
import { caseTitle } from "@/features/health/format";
import type { AnimalCategory } from "../../types";

function AlertBanner({ children }: { children: React.ReactNode }) {
  return (
    <Card className="flex items-center gap-3 border-warning/40 bg-warning-tint p-3">
      <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />
      <p className="text-sm font-medium text-warning">{children}</p>
    </Card>
  );
}

/**
 * Overview tab (unified animal-profile redesign, no ticket #) — a lightweight "quick glance" for
 * every non-`CALF` category (Heifer/Cow/Bull/Steer): alert flags (mortality/withholding/active
 * treatment from `useCattleHealthSummary`, same query `HealthTab` already fetches — dedupes, no
 * extra request), the soonest upcoming task for this animal (same `useTaskPagedList({ cattleId })`
 * query the new `TasksTab` uses — also dedupes), and a latest-weight/BCS snapshot (from
 * `useCattleOverview`, the same query `PerformanceTab` fetches). Deliberately does NOT repeat the
 * AQR/yield/lactation depth that lives on Performance — this tab is a status roundup, not a second
 * copy of Performance. `CALF` rows keep their existing, unchanged `CalfOverviewTab` content (birth
 * weight/ADG/weaning target) — that content was already a good "quick glance" for a calf.
 */
export function OverviewTab({ cattleId, animalCategory }: { cattleId: string; animalCategory: AnimalCategory }) {
  const isCalf = animalCategory === "CALF";
  const calfQuery = useCalfDetail(isCalf ? cattleId : undefined);

  if (isCalf) {
    if (calfQuery.isLoading) return <CardSkeleton lines={3} />;
    if (calfQuery.isError || !calfQuery.data) {
      return <ErrorState onRetry={() => calfQuery.refetch()} />;
    }
    return <CalfOverviewTab data={calfQuery.data} />;
  }

  return <NonCalfSnapshot cattleId={cattleId} />;
}

function NonCalfSnapshot({ cattleId }: { cattleId: string }) {
  const t = useTranslations("cattle.detail.snapshot");
  const tCondition = useTranslations("health.reportSickness");
  const overview = useCattleOverview(cattleId);
  const health = useCattleHealthSummary(cattleId);
  const tasks = useTaskPagedList({ cattleId });

  if (overview.isLoading || health.isLoading) return <CardSkeleton lines={3} />;
  if (overview.isError || health.isError) {
    return (
      <ErrorState
        description={t("error")}
        onRetry={() => {
          overview.refetch();
          health.refetch();
        }}
      />
    );
  }

  const overviewData = overview.data;
  const healthData = health.data;
  const latestBcs = overviewData?.bcs_records.at(-1)?.score ?? null;
  const nextTask = tasks.items[0] ?? null;
  const hasAlerts = Boolean(healthData?.mortalityStatus) || Boolean(healthData?.safetyWithdrawalWarning) || (healthData?.activeCases.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">{t("alerts")}</h3>
        {!hasAlerts ? (
          <p className="text-sm text-muted-foreground">{t("noAlerts")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {healthData?.mortalityStatus ? (
              <Card className="flex items-center gap-3 border-destructive/40 bg-destructive-tint p-3">
                <Skull className="size-4 shrink-0 text-destructive" aria-hidden />
                <p className="text-sm font-medium text-destructive">
                  {healthData.mortalityStatus.primaryCauseOfDeath} — <DateText date={healthData.mortalityStatus.deathDate} />
                </p>
              </Card>
            ) : null}
            {healthData?.safetyWithdrawalWarning ? <AlertBanner>{t("alerts")}</AlertBanner> : null}
            {(healthData?.activeCases.length ?? 0) > 0 ? (
              <AlertBanner>{healthData!.activeCases.map((c) => caseTitle(c, (condition) => tCondition(`conditionValue.${condition}`))).join(", ")}</AlertBanner>
            ) : null}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label={t("latestWeight")}
          value={overviewData?.last_weight_kg != null ? t("kg", { value: overviewData.last_weight_kg }) : "—"}
        />
        <StatCard label={t("latestBcs")} value={latestBcs ?? "—"} />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">{t("nextTask")}</h3>
        {!nextTask ? (
          <p className="text-sm text-muted-foreground">{t("noNextTask")}</p>
        ) : (
          <Card className="flex items-center gap-3 p-3">
            <ClipboardList className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="flex flex-col">
              <p className="text-sm font-medium text-foreground">{nextTask.name}</p>
              <p className="text-xs text-muted-foreground">
                <DateText date={nextTask.dueAt} />
              </p>
            </div>
            {nextTask.status === "COMPLETED" ? <Check className="ml-auto size-4 text-success" aria-hidden /> : null}
          </Card>
        )}
      </div>
    </div>
  );
}
