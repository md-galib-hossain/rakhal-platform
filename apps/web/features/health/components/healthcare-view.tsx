"use client"; // owns the Case Management sheet + picker dialogs' open state

import { useState } from "react";
import { HealthKeyMetricsCard } from "./health-key-metrics-card";
import { MorbidityTrendChart } from "./morbidity-trend-chart";
import { HealthManagementCenterCard } from "./health-management-center-card";
import { CaseManagementSheet } from "./case-management-sheet";
import { ReportSicknessDialog } from "./report-sickness-dialog";
import { SelectCaseDialog } from "./select-case-dialog";
import type { CaseManageTab } from "../types";

/** Healthcare dashboard/sick-bay page (Figma 734:35601) + the Case Management sheet
 * (734:37459/38378/39319/40144). Composition root — owns which case/tab is open so both the
 * table's "Manage Case" row action and the header's "Log Treatment" shortcut can open the same
 * sheet. */
export function HealthcareView() {
  const [manageCase, setManageCase] = useState<{ caseId: string; tab: CaseManageTab } | null>(null);
  const [reportSicknessOpen, setReportSicknessOpen] = useState(false);
  const [selectCaseOpen, setSelectCaseOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row">
        <HealthKeyMetricsCard />
        <MorbidityTrendChart />
      </div>

      <HealthManagementCenterCard
        onManageCase={(caseId) => setManageCase({ caseId, tab: "logTreatment" })}
        onReportSickness={() => setReportSicknessOpen(true)}
        onLogTreatment={() => setSelectCaseOpen(true)}
      />

      <CaseManagementSheet
        caseId={manageCase?.caseId ?? null}
        initialTab={manageCase?.tab}
        onOpenChange={(open) => {
          if (!open) setManageCase(null);
        }}
      />
      <ReportSicknessDialog open={reportSicknessOpen} onOpenChange={setReportSicknessOpen} />
      <SelectCaseDialog
        open={selectCaseOpen}
        onOpenChange={setSelectCaseOpen}
        onSelect={(caseId) => setManageCase({ caseId, tab: "logTreatment" })}
      />
    </div>
  );
}
