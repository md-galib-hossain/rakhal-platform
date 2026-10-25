import type { CreateReportResponse, CreateReportResult } from "../types";

/**
 * `POST /reports` answers 201 (new) or 200 (a duplicate of an identical report, or a replay of the same
 * Idempotency-Key). The status code is not needed: the body's `duplicate` flag is authoritative.
 * - `{duplicate:true, existing}`            -> `{kind:'duplicate'}`: the UI offers "open existing" or "generate again".
 * - `{duplicate:false, replayed, report}`   -> `{kind:'created'}` (`replayed` = same key answered again).
 */
export function toCreateResult(response: CreateReportResponse): CreateReportResult {
  if (response.duplicate) return { kind: "duplicate", existing: response.existing };
  return { kind: "created", report: response.report, replayed: response.replayed };
}
