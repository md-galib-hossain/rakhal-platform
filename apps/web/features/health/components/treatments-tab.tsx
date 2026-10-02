"use client";

import { useTranslations } from "next-intl";
import { Pagination } from "@/components/shared/pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DateText } from "@/components/shared/date-text";
import { AppliedProtocolChip } from "./applied-protocol-chip";
import { ProgressRing } from "./progress-ring";
import { SickBayTable } from "./sick-bay-table";
import { SafetyWithdrawalSection } from "./safety-withdrawal-tab";
import { useSickBayPagedList, usePlanApplications } from "../hooks/use-health";
import type { PlanApplicationListItem } from "../types";

/**
 * "Treatments" tab (RFE-107) — merges the old standalone Sick Bay table (curative cases, whether
 * or not a protocol is attached via RFE-106's "Apply Protocol") with a new "Preventive Rounds"
 * section reading RAKHAL-415's `PlanApplication`/`PlanEnrollment` tables. One tab, one mental
 * model, matching the backend's own curative-case vs preventive-round split — a preventive plan
 * apply produces no `HealthCase` at all, so it can no longer live in the Sick Bay table by
 * construction, not just by a since-removed diagnosisType filter.
 *
 * Round search is client-side over the fetched page (`GET /health/plan-applications` doesn't
 * support server-side search yet — a known, flagged backend v1 gap, see `health.service.ts`'s own
 * `getPlanApplications` doc comment) — same convention the retired `ActivePlansSection` used.
 *
 * RFE-110 adds a third section below: `SafetyWithdrawalSection`, folding the old standalone
 * Safety Withdrawals tab in as a "Withholding"/"All" filter instead of a 4th peer tab.
 */
export function TreatmentsTab({
  search,
  onManageCase,
}: {
  search: string;
  onManageCase: (caseId: string) => void;
}) {
  const t = useTranslations("health.treatments");
  const sickBay = useSickBayPagedList({ search: search || undefined });
  const rounds = usePlanApplications();

  const allRounds = rounds.data?.items ?? [];
  const filteredRounds = search
    ? allRounds.filter(
        (round) =>
          round.healthPlan.name.toLowerCase().includes(search.toLowerCase()) ||
          round.enrollments.some(
            (e) =>
              (e.cattle.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
              e.cattle.tagNumber.toLowerCase().includes(search.toLowerCase()),
          ),
      )
    : allRounds;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <SickBayTable
          items={sickBay.items}
          isLoading={sickBay.isLoading}
          isError={sickBay.isError}
          onRetry={sickBay.refetch}
          onManageCase={onManageCase}
        />
        {sickBay.totalPages > 1 ? (
          <Pagination
            page={sickBay.page}
            totalPages={sickBay.totalPages}
            onPageChange={sickBay.goToPage}
            isFetching={sickBay.isFetching}
            pageSize={sickBay.pageSize}
            onPageSizeChange={sickBay.setPageSize}
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-3 border-t border-dashed border-border pt-6">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-foreground">{t("preventiveRoundsTitle")}</h3>
          {allRounds.length > 0 ? (
            <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {allRounds.length}
            </span>
          ) : null}
        </div>

        {rounds.isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-md" />
            ))}
          </div>
        ) : rounds.isError ? (
          <ErrorState description={t("error")} onRetry={() => void rounds.refetch()} />
        ) : filteredRounds.length === 0 ? (
          <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[700px] border-collapse text-sm">
              <thead className="bg-muted">
                <tr>
                  {(["plan", "startDate", "animals", "progress"] as const).map((col) => (
                    <th key={col} className="h-[52px] px-4 text-left text-sm font-medium text-muted-foreground">
                      {t(`columns.${col}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRounds.map((round) => (
                  <RoundRow key={round.id} round={round} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SafetyWithdrawalSection />
    </div>
  );
}

function RoundRow({ round }: { round: PlanApplicationListItem }) {
  const t = useTranslations("health.treatments");
  const totalProgress = round.enrollments.length
    ? Math.round(
        round.enrollments.reduce((sum, e) => sum + e.progressPercentage, 0) / round.enrollments.length,
      )
    : 0;
  const preview = round.enrollments.slice(0, 3);
  const more = round.enrollments.length - preview.length;

  return (
    <tr className="border-t border-border transition-colors hover:bg-muted/30">
      <td className="px-4 py-3">
        <AppliedProtocolChip name={round.healthPlan.name} />
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        <DateText date={round.startDate} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center -space-x-2">
            {preview.map((e) => (
              <Avatar key={e.id} className="size-7 border-2 border-card">
                {e.cattle.image ? <AvatarImage src={e.cattle.image} alt="" /> : null}
                <AvatarFallback className="text-[10px]">
                  {(e.cattle.name ?? e.cattle.tagNumber).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
            {more > 0 ? (
              <span className="flex size-7 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-medium text-muted-foreground">
                +{more}
              </span>
            ) : null}
          </div>
          <span className="text-xs text-muted-foreground">{t("animalsCount", { count: round.animalCount })}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <ProgressRing value={totalProgress} size={20} strokeWidth={3} />
          <span className="text-sm text-muted-foreground">{totalProgress}%</span>
        </div>
      </td>
    </tr>
  );
}
