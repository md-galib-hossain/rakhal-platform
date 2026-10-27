"use client"; // URL-synced tab + search state

import { useTranslations } from "next-intl";
import { createParser, useQueryState } from "nuqs";
import { Stethoscope, Syringe } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
      <p className="text-xs text-muted-foreground">{t(`tabDescriptions.${tab}`)}</p>

      {tab === "treatments" ? (
        <HealthFilterBar
          searchPlaceholder={t("searchPlaceholder")}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="gap-2 border-destructive text-destructive hover:bg-destructive/5 rounded-xl h-11 px-4 text-sm font-semibold"
                onClick={onReportSickness}
              >
                <Stethoscope className="size-4" aria-hidden />
                <span>{t("reportSickness")}</span>
              </Button>
              <Button className="gap-2 rounded-xl h-11 px-4 text-sm font-semibold" onClick={onRecordTreatment}>
                <Syringe className="size-4" aria-hidden />
                <span>{t("recordTreatment")}</span>
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
