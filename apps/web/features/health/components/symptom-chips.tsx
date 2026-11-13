"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Input } from "@rakhal/ui/ui/input";
import { SYMPTOM_OPTIONS } from "../types";

const PRESET_VALUES = new Set(SYMPTOM_OPTIONS.map((s) => s.value));

/** "Signs & Symptoms" multi-select chip grid — shared by the Health Update tab (734:38378) and the
 * Close Case → Log Mortality sub-tab (734:40144), both use the identical 8-chip set in Figma. Backed
 * by the free-text `symptoms: string[]` on both `CreateHealthUpdateDto` and `MortalityDto`. Also used
 * by the Report Sickness dialog (out-of-Figma-scope, mirrors `CreateHealthCaseDto`). Since the field
 * is free-text on the backend, a manual entry input sits alongside the preset chips for symptoms not
 * on the curated 7-item list. */
export function SymptomChips({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const t = useTranslations("health.symptoms");
  const [draft, setDraft] = useState("");

  function toggle(symptom: string) {
    onChange(value.includes(symptom) ? value.filter((s) => s !== symptom) : [...value, symptom]);
  }

  function addDraft() {
    const trimmed = draft.trim();
    if (trimmed && !value.includes(trimmed)) onChange([...value, trimmed]);
    setDraft("");
  }

  const customValues = value.filter((v) => !PRESET_VALUES.has(v));

  return (
    <div className="flex flex-col gap-2">
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
        {customValues.map((symptom) => (
          <span
            key={symptom}
            className="flex items-center gap-1.5 rounded-md border border-primary px-3 py-2 text-sm font-medium text-primary"
          >
            {symptom}
            <button type="button" onClick={() => toggle(symptom)} aria-label={t("removeOther")}>
              <X className="size-3.5" />
            </button>
          </span>
        ))}
      </div>
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addDraft();
          }
        }}
        onBlur={addDraft}
        placeholder={t("otherPlaceholder")}
        className="max-w-xs"
      />
    </div>
  );
}
