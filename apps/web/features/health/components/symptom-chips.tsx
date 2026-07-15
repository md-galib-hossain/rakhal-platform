"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { SYMPTOM_OPTIONS } from "../types";

/** "Signs & Symptoms" multi-select chip grid — shared by the Health Update tab (734:38378) and the
 * Close Case → Log Mortality sub-tab (734:40144), both use the identical 8-chip set in Figma. Backed
 * by the free-text `symptoms: string[]` on both `CreateHealthUpdateDto` and `MortalityDto`. */
export function SymptomChips({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const t = useTranslations("health.symptoms");

  function toggle(symptom: string) {
    onChange(value.includes(symptom) ? value.filter((s) => s !== symptom) : [...value, symptom]);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {SYMPTOM_OPTIONS.map((symptom) => (
        <button
          key={symptom.value}
          type="button"
          onClick={() => toggle(symptom.value)}
          className={cn(
            "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
            value.includes(symptom.value)
              ? "border-primary text-primary"
              : "border-border text-muted-foreground hover:border-foreground/30",
          )}
        >
          {t(symptom.key)}
        </button>
      ))}
    </div>
  );
}
