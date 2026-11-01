import { cn } from "@/lib/utils";

/**
 * Compact label / value / hint tile (RFE-177): used by the Animal Workspace header and its drill panels. Quieter than
 * `StatCard` (no icon chip, no trend). Render inside a `<dl>`; a missing value is the caller's `—`.
 */
export function StatTile({
  label,
  value,
  hint,
  muted,
  className,
}: {
  label: string;
  value: string;
  hint?: string | null;
  /** Value is absent: dims it so a dash does not read like a number. */
  muted?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5 rounded-lg border border-border bg-muted/40 px-3 py-2", className)}>
      <dt className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("truncate text-lg font-semibold tabular-nums", muted ? "text-muted-foreground" : "text-foreground")}>{value}</dd>
      {hint ? <dd className="truncate text-xs text-muted-foreground">{hint}</dd> : null}
    </div>
  );
}
