"use client"; // interactive segmented control; state is owned by the parent form

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { HealthPriority } from "../../types";

const PRIORITIES: HealthPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const SELECTED_CLASS: Record<HealthPriority, string> = {
  LOW: "border-foreground/40 bg-muted text-foreground",
  MEDIUM: "border-warning bg-warning-tint text-warning",
  HIGH: "border-destructive bg-destructive-tint text-destructive",
  CRITICAL: "border-destructive bg-destructive text-destructive-foreground",
};

/** RFE-133 — 4-segment priority with a one-line hint for the selected level, so "High" vs "Critical" is
 * decided by what the animal is doing, not by guessing what the words mean. */
export function PrioritySegmented({
  value,
  onChange,
}: {
  value: HealthPriority;
  onChange: (next: HealthPriority) => void;
}) {
  const t = useTranslations("health.reportSickness");
  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label={t("priority")} className="grid grid-cols-4 gap-2">
        {PRIORITIES.map((priority) => {
          const selected = value === priority;
          return (
            <button
              key={priority}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(priority)}
              className={cn(
                "min-h-11 rounded-lg border px-2 py-2 text-sm font-medium transition-colors",
                selected ? SELECTED_CLASS[priority] : "border-border text-muted-foreground hover:border-foreground/30",
              )}
            >
              {t(`priorityValue.${priority}`)}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{t(`priorityHint.${value}`)}</p>
    </div>
  );
}
