import type { ReportSummary } from "@/features/reports";

/** Test fixture: a valid `ReportSummary` with sensible COMPLETED defaults. */
export function makeReport(over: Partial<ReportSummary> = {}): ReportSummary {
  return {
    id: "r1",
    type: "WEEKLY",
    origin: "SCHEDULED",
    status: "COMPLETED",
    templateVersion: 1,
    period: { startDate: "2026-10-12", endDate: "2026-10-18", timezone: "Asia/Dhaka" },
    scope: { kind: "ALL_ELIGIBLE" },
    selectedMetricIds: [],
    includesFinance: false,
    hasPdf: true,
    pdfBytes: 1000,
    attempts: 1,
    errorCategory: null,
    errorMessage: null,
    createdAt: "2026-10-19T02:00:00.000Z",
    startedAt: "2026-10-19T02:00:01.000Z",
    completedAt: "2026-10-19T02:00:05.000Z",
    expiresAt: null,
    ...over,
  };
}
