"use client"; // live query: polls while the report is generating

import { useReport } from "../../hooks/use-report";
import { useReportsAccess } from "../../hooks/use-reports-access";
import { isReportAccessDenied, toReportApiError } from "../../lib/errors";
import { ReportBody } from "./report-body";
import {
  ReportDetailSkeleton,
  ReportFailedState,
  ReportLoadErrorState,
  ReportNoAccessState,
  ReportNotFoundState,
  ReportPendingState,
} from "./report-detail-states";
import { ReportHeader } from "./report-header";

/**
 * The /reports/[id] body. A status state machine over `useReport`:
 * loading -> (404 | no access | error) | QUEUED/PROCESSING (polling) | FAILED | COMPLETED.
 * Client component because the query polls every 2 s until the report is terminal.
 */
export function ReportDetailView({ id }: { id: string }) {
  const query = useReport(id);
  const access = useReportsAccess();

  if (query.isError) {
    const error = toReportApiError(query.error);
    if ((error as { status?: number }).status === 404) return <ReportNotFoundState />;
    if (isReportAccessDenied(error)) return <ReportNoAccessState />;
    return <ReportLoadErrorState error={error} onRetry={() => void query.refetch()} />;
  }
  const report = query.data;
  if (!report) return <ReportDetailSkeleton />;

  if (report.status === "QUEUED" || report.status === "PROCESSING") {
    return (
      <ReportPendingState
        status={report.status}
        timedOut={query.pollTimedOut}
        onRefresh={() => void query.refetch()}
        refreshing={query.isFetching}
      />
    );
  }
  if (report.status === "FAILED") return <ReportFailedState report={report} />;

  if (!report.payload) {
    // COMPLETED but no snapshot: should not happen; treat as a load failure rather than render an empty report.
    return <ReportLoadErrorState error={null} onRetry={() => void query.refetch()} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <ReportHeader report={report} payload={report.payload} canDelete={access.canDelete} />
      <ReportBody payload={report.payload} canViewFinance={access.canViewFinance} />
    </div>
  );
}
