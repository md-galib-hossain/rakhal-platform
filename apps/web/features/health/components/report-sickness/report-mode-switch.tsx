"use client"; // interactive radio group

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type ReportMode = "one" | "many";

/** RFE-139 — "One animal | Several animals" at the top of the Report Sickness sheet. The default stays one animal; the
 * switch is a deliberate, visible choice rather than a hidden power-user feature. 44px targets, like the rest of the
 * sheet: it is used standing in a shed. */
export function ReportModeSwitch({ value, onChange, disabled }: { value: ReportMode; onChange: (next: ReportMode) => void; disabled?: boolean }) {
  const t = useTranslations("health.reportSickness.bulk.mode");
  return (
    <div role="radiogroup" aria-label={t("label")} className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted p-1">
      {(["one", "many"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={value === mode}
          disabled={disabled}
          onClick={() => onChange(mode)}
          className={cn(
            "min-h-11 rounded-lg px-3 text-sm font-medium transition-colors",
            value === mode ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t(mode)}
        </button>
      ))}
    </div>
  );
}
