"use client"; // URL-synced view switch

import { useTranslations } from "next-intl";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/shared/pagination";
import { SickBayTable } from "./sick-bay-table";
import { SafetyWithdrawalSection } from "./safety-withdrawal-tab";
import { useHealthDashboard, useSickBayPagedList } from "../hooks/use-health";
import { SICK_BAY_VIEWS, type SickBayView } from "../types";

const VIEW_KEYS = SICK_BAY_VIEWS as unknown as [SickBayView, ...SickBayView[]];

/**
 * "Sick Bay" tab (key `treatments`, RFE-107; relabelled and reshaped by RFE-141). It used to stack three tables — Sick
 * Bay, Preventive Rounds, Safety Withdrawals — which made the page long and hid the second and third below the fold.
 * Now ONE list is on screen at a time, picked by a switch that lives in the URL (`?bay=`, never `?view=` - that is the animal-details modal's), and every list pages:
 *   - `cases`    — animals under treatment (curative `HealthCase`, with or without a protocol; server search),
 *   - `withheld` — animals whose milk/meat is withheld (safety withdrawals, incl. ones whose case is already closed),
 * (RFE-143 removed the third view, preventive rounds: each is now listed under its protocol, in the Protocols tab's sheet.)
 * The two pill counts come from the dashboard's server counts (already cached by the stat strip), never from the size
 * of the page on screen.
 *
 */
export function TreatmentsTab({
  search,
  onManageCase,
}: {
  search: string;
  onManageCase: (caseId: string) => void;
}) {
  const t = useTranslations("health.treatments");
  const [view, setView] = useQueryState("bay", parseAsStringEnum<SickBayView>(VIEW_KEYS).withDefault("cases"));
  const dashboard = useHealthDashboard();
  const counts: Partial<Record<SickBayView, number>> = {
    cases: dashboard.data?.sickBayCount,
    withheld: dashboard.data?.safetyWithdrawalCount,
  };

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label={t("viewLabel")} className="flex flex-wrap items-center gap-2">
        {SICK_BAY_VIEWS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            onClick={() => void setView(key)}
            className={cn(
              "flex min-h-9 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
              view === key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            )}
          >
            {t(`views.${key}`)}
            {counts[key] !== undefined ? (
              <span className={cn("rounded-full px-1.5 text-xs", view === key ? "bg-primary/15" : "bg-muted")}>{counts[key]}</span>
            ) : null}
          </button>
        ))}
      </div>

      {view === "cases" ? <CasesView search={search} onManageCase={onManageCase} /> : <SafetyWithdrawalSection />}
    </div>
  );
}

function CasesView({ search, onManageCase }: { search: string; onManageCase: (caseId: string) => void }) {
  const sickBay = useSickBayPagedList({ search: search || undefined });
  return (
    <div className="flex flex-col gap-4">
      <SickBayTable items={sickBay.items} isLoading={sickBay.isLoading} isError={sickBay.isError} onRetry={sickBay.refetch} onManageCase={onManageCase} />
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
  );
}
