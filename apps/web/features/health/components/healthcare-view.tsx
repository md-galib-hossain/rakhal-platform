"use client"; // owns the Case Management sheet + picker dialogs' open state

import { useState } from "react";
import { HealthStatStrip } from "./health-stat-strip";
import { HealthManagementCenterCard } from "./health-management-center-card";
import { CaseManagementSheet } from "./case-management-sheet";
import { ReportSicknessDialog } from "./report-sickness-dialog";
import { QuickTreatDialog } from "./quick-treat-dialog";
import type { CaseManageTab } from "../types";

/** Healthcare dashboard/sick-bay page (Figma 734:35601) + the Case Management sheet
 * (734:37459/38378/39319/40144). Composition root — owns which case/tab is open so both the
 * table's "Manage Case" row action and the Report sickness flow can open the same sheet.
 * RFE-140: the page is a one-row stat strip and the Management Center. The Key Metrics ring card, the trend chart and the
 * outcomes card are gone from the top (trend + outcomes are the Management Center's Insights tab). */
export function HealthcareView() {
  const [manageCase, setManageCase] = useState<{ caseId: string; tab: CaseManageTab } | null>(null);
  const [reportSicknessOpen, setReportSicknessOpen] = useState(false);
  const [quickTreatOpen, setQuickTreatOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <HealthStatStrip />

      <HealthManagementCenterCard
        onManageCase={(caseId) => setManageCase({ caseId, tab: "overview" })}
        onReportSickness={() => setReportSicknessOpen(true)}
        onRecordTreatment={() => setQuickTreatOpen(true)}
      />

      <CaseManagementSheet
        caseId={manageCase?.caseId ?? null}
        initialTab={manageCase?.tab}
        onOpenChange={(open) => {
          if (!open) setManageCase(null);
        }}
      />
      <ReportSicknessDialog
        open={reportSicknessOpen}
        onOpenChange={setReportSicknessOpen}
        onOpenCase={(caseId, tab = "overview") => setManageCase({ caseId, tab })}
      />
      <QuickTreatDialog open={quickTreatOpen} onOpenChange={setQuickTreatOpen} />
    </div>
  );
}
