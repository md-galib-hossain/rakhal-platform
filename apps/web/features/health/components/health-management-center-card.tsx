"use client"; // URL-synced tab + search state

import { useTranslations } from "next-intl";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { Stethoscope, Syringe } from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterBar } from "@/components/shared/filter-bar";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/shared/pagination";
import { useSickBayPagedList } from "../hooks/use-health";
import { HEALTH_MANAGEMENT_TABS, type HealthManagementTab } from "../types";
import { SickBayTable } from "./sick-bay-table";
import { TaskHubTab } from "./task-hub-tab";
import { HealthPlanTab } from "./health-plan-tab";
import { SafetyWithdrawalTab } from "./safety-withdrawal-tab";
import { HealthCard } from "./health-card";

const TAB_KEYS = HEALTH_MANAGEMENT_TABS as unknown as [HealthManagementTab, ...HealthManagementTab[]];

/** Figma "Health Management Center" card (node 734:35786). Only the Sick Bay tab has a Figma frame
 * (the table); Task Hub/Health Plan are real but plainly-styled (see their own components' doc
 * comments). "Report Sickness"/"Log Treatment" are page-level actions with no target case yet — no
 * Figma frame was given for either, so they're wired to small non-Figma pickers (see
 * `HealthcareView`) rather than left dead. */
export function HealthManagementCenterCard({
  onManageCase,
  onReportSickness,
  onLogTreatment,
}: {
  onManageCase: (caseId: string) => void;
  onReportSickness: () => void;
  onLogTreatment: () => void;
}) {
  const t = useTranslations("health.managementCenter");
  const [tab, setTab] = useQueryState("healthTab", parseAsStringEnum<HealthManagementTab>(TAB_KEYS).withDefault("sickBay"));
  const [search] = useQueryState("q");

  const sickBay = useSickBayPagedList({ search: search || undefined });

  return (
    <HealthCard
      title={t("title")}
      headerRight={
        <div className="flex items-center gap-1 rounded-xl border border-border bg-muted p-1">
          {HEALTH_MANAGEMENT_TABS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => void setTab(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                tab === key ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`tabs.${key}`)}
            </button>
          ))}
        </div>
      }
      className="w-full"
    >
      <p className="text-xs text-muted-foreground">{t(`tabDescriptions.${tab}`)}</p>

      {tab === "sickBay" ? (
        <div className="flex items-center justify-between gap-3">
          <FilterBar searchKey="q" searchPlaceholder={t("searchPlaceholder")} />
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2 border-destructive text-destructive hover:bg-destructive/5" onClick={onReportSickness}>
              <Stethoscope className="size-4" aria-hidden />
              {t("reportSickness")}
            </Button>
            <Button className="gap-2" onClick={onLogTreatment}>
              <Syringe className="size-4" aria-hidden />
              {t("logTreatment")}
            </Button>
          </div>
        </div>
      ) : null}

      {tab === "sickBay" ? (
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
      ) : tab === "taskHub" ? (
        <TaskHubTab />
      ) : tab === "healthPlan" ? (
        <HealthPlanTab />
      ) : (
        <SafetyWithdrawalTab />
      )}
    </HealthCard>
  );
}
