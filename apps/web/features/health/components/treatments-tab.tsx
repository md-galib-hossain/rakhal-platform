"use client"; // URL-synced view switch

import { useTranslations } from "next-intl";
import { parseAsString, parseAsStringEnum, useQueryState } from "nuqs";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@rakhal/ui/ui/tabs";
import { Pagination } from "@/components/shared/pagination";
import { SickBayTable } from "./sick-bay-table";
import { SafetyWithdrawalSection } from "./safety-withdrawal-tab";
import { TreatmentHistorySection } from "./treatment-history-table";
import { useHealthDashboard, useSickBayPagedList } from "../hooks/use-health";
import { SICK_BAY_VIEWS, type HealthCaseStatus, type HealthPriority, type SickBayView } from "../types";

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
  hideScopeSwitcher = false,
}: {
  search: string;
  onManageCase: (caseId: string) => void;
  hideScopeSwitcher?: boolean;
}) {
  const t = useTranslations("health.treatments");
  const [view, setView] = useQueryState("bay", parseAsStringEnum<SickBayView>(VIEW_KEYS).withDefault("cases"));
  const dashboard = useHealthDashboard();
  const counts: Partial<Record<SickBayView, number>> = {
    cases: dashboard.data?.sickBayCount,
    withheld: dashboard.data?.safetyWithdrawalCount,
  };

  const [withdrawalStatus, setWithdrawalStatus] = useQueryState("withdrawalStatus", parseAsString);

  return (
    <div className="flex flex-col gap-4">
      {!hideScopeSwitcher && (
        <Tabs value={view} onValueChange={(v) => void setView(v as SickBayView)}>
          <TabsList aria-label={t("viewLabel")}>
            {SICK_BAY_VIEWS.map((key) => (
              <TabsTrigger key={key} value={key}>
                {t(`views.${key}`)}
                {counts[key] !== undefined ? (
                  <span
                    className={cn(
                      "ml-1.5 min-w-4.5 rounded-full px-1 text-center text-[0.7rem] font-bold leading-4",
                      view === key ? "bg-primary/15 text-primary" : "bg-background/60 text-muted-foreground",
                    )}
                  >
                    {counts[key]}
                  </span>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {view === "cases" ? (
        <CasesView search={search} onManageCase={onManageCase} />
      ) : view === "history" ? (
        <TreatmentHistorySection search={search} />
      ) : (
        <SafetyWithdrawalSection
          hideFilterSwitch={hideScopeSwitcher}
          filter={withdrawalStatus === "all" ? "all" : "withholding"}
          onFilterChange={(f) => void setWithdrawalStatus(f === "withholding" ? null : f)}
        />
      )}
    </div>
  );
}

function CasesView({ search, onManageCase }: { search: string; onManageCase: (caseId: string) => void }) {
  const [condition] = useQueryState("condition", parseAsString);
  const [priority] = useQueryState("priority", parseAsString);
  const [caseStatus] = useQueryState("caseStatus", parseAsString);
  const [shed] = useQueryState("shed", parseAsString);

  const sickBay = useSickBayPagedList({
    search: search || undefined,
    diagnosis: condition || undefined,
    priority: (priority as HealthPriority) || undefined,
    status: (caseStatus as HealthCaseStatus) || undefined,
    shed: shed || undefined,
  });
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
