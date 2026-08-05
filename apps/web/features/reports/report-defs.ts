import type { GenerateReportDialogDef } from "./components/report-catalogue";

/**
 * Static metadata for the 5 record-export report types (backend `report-catalogue.ts`), used by
 * per-page "Export" buttons (Cattle/Milk/Finance/Healthcare/Dashboard) so they don't need to fetch
 * the full `/reports` catalogue just to know one report's name/formats/params. Names/descriptions
 * mirror the backend's `REPORTS` array verbatim — the reports engine's metadata is English-only
 * today (same as every other report in the catalogue, none are translated), not a gap introduced
 * here.
 */
export const CATTLE_EXPORT_REPORT: GenerateReportDialogDef = {
  id: "rpt_cattle_export",
  name: "Cattle Export",
  description:
    "Full cattle list with breed, status, production status, shed, BCS, and weight — optionally filtered by shed, status, or search.",
  formats: ["pdf", "csv"],
  params: ["shedId", "status", "search"],
};

export const MILK_EXPORT_REPORT: GenerateReportDialogDef = {
  id: "rpt_milk_export",
  name: "Milk Log Export",
  description: "Every milk log entry in a date range — cow, session, yield, tank type, submitted status.",
  formats: ["pdf", "csv"],
  params: ["fromDate", "toDate"],
};

export const FINANCE_EXPORT_REPORT: GenerateReportDialogDef = {
  id: "rpt_finance_export",
  name: "Finance Transactions Export",
  description:
    "Every finance transaction in a date range, including voided/reversal rows — optionally filtered by category, status, or search.",
  formats: ["pdf", "csv"],
  params: ["fromDate", "toDate", "category", "status", "search"],
};

export const HEALTHCARE_EXPORT_REPORT: GenerateReportDialogDef = {
  id: "rpt_healthcare_export",
  name: "Healthcare Cases Export",
  description:
    "All health cases with diagnosis, priority, status, shed, and key dates — optionally filtered by status or search.",
  formats: ["pdf", "csv"],
  params: ["status", "search"],
};

export const DASHBOARD_EXPORT_REPORT: GenerateReportDialogDef = {
  id: "rpt_dashboard_export",
  name: "Dashboard Export",
  description: "Snapshot of the live dashboard — production, reproduction, health, and finance — as one multi-section PDF.",
  formats: ["pdf"],
  params: [],
};
