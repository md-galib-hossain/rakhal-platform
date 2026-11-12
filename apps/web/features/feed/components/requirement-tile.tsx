import { cn } from "@/lib/utils";

/** Shared by `create-feed-dialog.tsx`'s Step 1 preview and `nutrition-calculator.tsx` (extracted
 * 2026-07-18 — the standalone calculator reuses the exact same tile instead of duplicating it). */
const TONE_TEXT_CLASS: Record<"foreground" | "info" | "warning" | "success", string> = {
  foreground: "text-muted-foreground",
  info: "text-info",
  warning: "text-warning",
  success: "text-success",
};

export function RequirementTile({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: number;
  unit: string;
  tone: "foreground" | "info" | "warning" | "success";
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-card p-3">
      <p className={cn("text-sm", TONE_TEXT_CLASS[tone])}>{label}</p>
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className={cn("text-sm", TONE_TEXT_CLASS[tone])}>{unit}</p>
    </div>
  );
}
