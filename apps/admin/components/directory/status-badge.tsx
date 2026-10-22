import { humanizeEnum } from "@/lib/format";

const TONE: Record<string, string> = {
  ACTIVE: "bg-success-tint text-success",
  TRIALING: "bg-info-tint text-info",
  SUCCESS: "bg-success-tint text-success",
  SUSPENDED: "bg-warning-tint text-warning",
  PAST_DUE: "bg-warning-tint text-warning",
  ARCHIVED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-muted text-muted-foreground",
  EXPIRED: "bg-muted text-muted-foreground",
  FAILURE: "bg-destructive-tint text-destructive",
  BLOCKED: "bg-destructive-tint text-destructive",
  OK: "bg-success-tint text-success",
  DEGRADED: "bg-warning-tint text-warning",
  DOWN: "bg-destructive-tint text-destructive",
  NOT_CONFIGURED: "bg-muted text-muted-foreground",
  INFO: "bg-info-tint text-info",
  ON: "bg-success-tint text-success",
  OFF: "bg-muted text-muted-foreground",
};

/** Status pill. Colour is never the only signal - the status text is always shown. */
export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${TONE[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {humanizeEnum(status)}
    </span>
  );
}
