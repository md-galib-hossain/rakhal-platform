import type { ReportStatus } from "../types";

/** `@rakhal/ui/ui/badge` variant names, so the UI can pass the result straight to `<Badge variant>`. */
export type ReportStatusTone = "secondary" | "info" | "success" | "destructive";

export function statusTone(status: ReportStatus): ReportStatusTone {
  switch (status) {
    case "QUEUED":
      return "secondary";
    case "PROCESSING":
      return "info";
    case "COMPLETED":
      return "success";
    case "FAILED":
      return "destructive";
  }
}
