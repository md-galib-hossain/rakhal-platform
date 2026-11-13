import { Loader2 } from "lucide-react";
import { Badge } from "@rakhal/ui/ui/badge";
import { statusTone, type ReportStatus } from "@/features/reports";

/**
 * Status chip: colour from `statusTone`, label passed in (`reports.status.*`). QUEUED/PROCESSING carry a spinner
 * (stopped under reduced motion) so the state reads without relying on colour alone.
 */
export function ReportStatusBadge({ status, label }: { status: ReportStatus; label: string }) {
  const pending = status === "QUEUED" || status === "PROCESSING";
  return (
    <Badge variant={statusTone(status)} data-status={status}>
      {pending ? <Loader2 className="size-3 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
      {label}
    </Badge>
  );
}
