"use client"; // selection state is owned by the parent form; this is an interactive radio group

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { HealthCondition } from "../../types";

export const HEALTH_CONDITIONS: HealthCondition[] = [
  "MASTITIS",
  "LAMENESS",
  "METRITIS",
  "KETOSIS",
  "MILK_FEVER",
  "FEVER",
  "INJURY",
  "OTHER",
];

/** RFE-133 — "what's wrong" as one-tap chips instead of an 8-option dropdown. 44px targets: the person
 * reporting is usually standing in a shed on a phone. */
export function ConditionChips({
  value,
  onChange,
  invalid = false,
}: {
  value: HealthCondition | undefined;
  onChange: (next: HealthCondition) => void;
  invalid?: boolean;
}) {
  const t = useTranslations("health.reportSickness");
  return (
    <div role="radiogroup" aria-label={t("condition")} aria-invalid={invalid} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {HEALTH_CONDITIONS.map((condition) => {
        const selected = value === condition;
        return (
          <button
            key={condition}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(condition)}
            className={cn(
              "min-h-11 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              selected
                ? "border-primary bg-primary/10 text-primary"
                : invalid
                  ? "border-destructive/60 text-foreground hover:border-destructive"
                  : "border-border text-foreground hover:border-foreground/30",
            )}
          >
            {t(`conditionValue.${condition}`)}
          </button>
        );
      })}
    </div>
  );
}
