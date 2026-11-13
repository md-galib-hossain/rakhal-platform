"use client"; // URL-synced tab + search state

import { useTranslations } from "next-intl";
import { createParser, useQueryState } from "nuqs";
import { Stethoscope, Syringe } from "lucide-react";
import { Button } from "@rakhal/ui/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HEALTH_MANAGEMENT_TABS, type HealthManagementTab } from "../types";
import { TreatmentsTab } from "./treatments-tab";
import { HealthPlanTab } from "./health-plan-tab";
import { HealthCard } from "./health-card";
import { HealthInsightsTab } from "./health-insights-tab";
import { HealthFilterBar } from "./health-filter-bar";
import { parseAppliedStatus } from "../round-model";

/** `?healthTab=` -> a tab. RFE-143 removed the `schedule` ("Care steps") tab; reminder notifications sent before that still
 * link to it, so it opens Protocols (where the due steps are now recorded) instead of falling back to Sick Bay. */
export function parseHealthTab(value: string): HealthManagementTab | null {
  if (value === "schedule") return "protocols";
  return (HEALTH_MANAGEMENT_TABS as readonly string[]).includes(value) ? (value as HealthManagementTab) : null;
}
const healthTabParser = createParser<HealthManagementTab>({ parse: parseHealthTab, serialize: (v) => v });

/** Figma "Health Management Center" card (node 734:35786). Only the Sick Bay table (now inside
 * `TreatmentsTab`) has a Figma frame; Schedule/Protocols are real but plainly-styled (see their own
 * components' doc comments). "Report Sickness"/"Log Treatment"/"Quick Treat" are page-level actions
 * with no target case yet — no Figma frame was given for any of them, so they're wired to small
 * non-Figma pickers (see `HealthcareView`) rather than left dead. **RFE-134**: the toolbar is two buttons — Report
 * sickness and Record treatment (the old "Log Treatment → pick a case" is gone; Record treatment reuses the animal's
 * open case itself). **RFE-140**: the attention strip (overdue / due today / withdrawals ending) is gone — those
 * counts came from the first 100 rows and the owner did not want them; the 4th tab is Insights (trend + outcomes).
 * **RFE-143**: the Care steps (`schedule`) tab is gone - its steps are recorded from the protocol sheet in Protocols.
 * **RFE-107**: 4 tabs collapsed to
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
  const [tab, setTab] = useQueryState("healthTab", healthTabParser.withDefault("treatments"));
  const [search] = useQueryState("q");
  // RFE-150: `?round=<roundKey>` (the needs-attention strip's link) opens that round's sheet once, then is cleared.
  const [roundKey, setRoundKey] = useQueryState("round");
  // `?status=needs|upcoming|finished|all` — the Applied list's status choice (the Late steps tile links to `needs`).
  const [statusParam, setStatusParam] = useQueryState("status");

  return (
    <HealthCard
      title={t("title")}
      headerRight={
        <Tabs value={tab} onValueChange={(v) => void setTab(v as HealthManagementTab)}>
          <TabsList>
            {HEALTH_MANAGEMENT_TABS.map((key) => (
              <TabsTrigger key={key} value={key}>
                {t(`tabs.${key}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      }
      className="w-full"
    >
      <p className="text-xs text-muted-foreground">{t(`tabDescriptions.${tab}`)}</p>

      {tab === "treatments" ? (
        <HealthFilterBar
          searchPlaceholder={t("searchPlaceholder")}
          actions={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              {/* Primary action first and filled; the secondary one is outlined. Stacked full-width on a phone so neither label truncates. */}
              <Button
                className="h-11 w-full gap-2 rounded-xl px-4 text-sm font-semibold sm:w-auto"
                onClick={onReportSickness}
              >
                <Stethoscope className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{t("reportSickness")}</span>
              </Button>
              <Button
                variant="outline"
                className="h-11 w-full gap-2 rounded-xl px-4 text-sm font-semibold sm:w-auto"
                onClick={onRecordTreatment}
              >
                <Syringe className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{t("recordTreatment")}</span>
              </Button>
            </div>
          }
        />
      ) : null}

      {tab === "treatments" ? (
        <TreatmentsTab search={search || ""} onManageCase={onManageCase} hideScopeSwitcher />
      ) : tab === "protocols" ? (
        <HealthPlanTab onManageCase={onManageCase} openRoundKey={roundKey} onRoundOpened={() => void setRoundKey(null)} status={parseAppliedStatus(statusParam)} onStatusChange={(next) => void setStatusParam(next)} />
      ) : (
        <HealthInsightsTab />
      )}
    </HealthCard>
  );
}
