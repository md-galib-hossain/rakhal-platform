import { isTerminalStatus, type ReportStatus } from "../types";

/** Poll cadence while a report is QUEUED/PROCESSING. */
export const REPORT_POLL_INTERVAL_MS = 2_000;
/** Safety stop: give up polling after this long even if the status never turns terminal. */
export const REPORT_POLL_MAX_MS = 10 * 60_000;

/**
 * react-query `refetchInterval` decision, pure so it is testable:
 * - no data yet (first load in flight) or the last fetch errored -> stop (`false`);
 * - COMPLETED / FAILED -> stop;
 * - QUEUED / PROCESSING -> 2 s, until `elapsedMs` reaches the 10-minute safety stop.
 */
export function nextReportPollInterval(input: {
  status: ReportStatus | undefined;
  isError: boolean;
  /** Time since polling began for this report. */
  elapsedMs: number;
}): number | false {
  if (input.isError) return false;
  if (!input.status || isTerminalStatus(input.status)) return false;
  if (input.elapsedMs >= REPORT_POLL_MAX_MS) return false;
  return REPORT_POLL_INTERVAL_MS;
}
