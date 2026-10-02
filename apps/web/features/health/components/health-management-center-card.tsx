"use client"; // URL-synced tab + search state

import { useTranslations } from "next-intl";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { Stethoscope, Syringe } from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterBar } from "@/components/shared/filter-bar";
import { Button } from "@/components/ui/button";
import { HEALTH_MANAGEMENT_TABS, type HealthManagementTab } from "../types";
import { TreatmentsTab } from "./treatments-tab";
import { TaskHubTab } from "./task-hub-tab";
import { HealthPlanTab } from "./health-plan-tab";
import { HealthCard } from "./health-card";
import { AttentionStrip } from "./attention-strip";

const TAB_KEYS = HEALTH_MANAGEMENT_TABS as unknown as [HealthManagementTab, ...HealthManagementTab[]];

/** Figma "Health Management Center" card (node 734:35786). Only the Sick Bay table (now inside
 * `TreatmentsTab`) has a Figma frame; Schedule/Protocols are real but plainly-styled (see their own
 * components' doc comments). "Report Sickness"/"Log Treatment"/"Quick Treat" are page-level actions
 * with no target case yet — no Figma frame was given for any of them, so they're wired to small
 * non-Figma pickers (see `HealthcareView`) rather than left dead. **RFE-134**: the toolbar is two buttons — Report
 * sickness and Record treatment (the old "Log Treatment → pick a case" is gone; Record treatment reuses the animal's
 * open case itself) — and an attention strip sits above the tabs. **RFE-107**: 4 tabs collapsed to
 * 3 (`treatments`/`schedule`/`protocols`) — see `types.ts`'s `HEALTH_MANAGEMENT_TABS` doc comment
 * for the full mapping, including the `safetyWithdrawals` tab's deliberate, ticket-sequenced
 * removal (RFE-110 folds it back in as a filter, not a peer tab). */
export function HealthManagementCenterCard({
  onManageCase,
  onReportSickness,
  onRecordTreatment,
}: {
  onManageCase: (caseId: string) => void;
  onReportSickness: () => void;
  onRecordTreatment: () => void;
}) {
  const t = useTranslations("health.managementCenter");
  const [tab, setTab] = useQueryState("healthTab", parseAsStringEnum<HealthManagementTab>(TAB_KEYS).withDefault("treatments"));
  const [search] = useQueryState("q");

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
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:px-4",
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
      <AttentionStrip />

      <p className="text-xs text-muted-foreground">{t(`tabDescriptions.${tab}`)}</p>

      {tab === "treatments" ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1 basis-56">
            <FilterBar searchKey="q" searchPlaceholder={t("searchPlaceholder")} />
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button variant="outline" className="gap-2 border-destructive text-destructive hover:bg-destructive/5" onClick={onReportSickness}>
              <Stethoscope className="size-4" aria-hidden />
              {t("reportSickness")}
            </Button>
            <Button className="gap-2" onClick={onRecordTreatment}>
              <Syringe className="size-4" aria-hidden />
              {t("recordTreatment")}
            </Button>
          </div>
        </div>
      ) : null}

      {tab === "treatments" ? (
        <TreatmentsTab search={search || ""} onManageCase={onManageCase} />
      ) : tab === "schedule" ? (
        <TaskHubTab />
      ) : (
        <HealthPlanTab />
      )}
    </HealthCard>
  );
}
