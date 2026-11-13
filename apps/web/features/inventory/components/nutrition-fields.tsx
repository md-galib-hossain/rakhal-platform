"use client"; // controlled form section — local text state for partially-typed numbers

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LabeledInput, LabeledSelectTrigger } from "@rakhal/ui/ui/labeled-field";
import { Select, SelectContent, SelectItem } from "@rakhal/ui/ui/select";
import { OPTIONAL_NUTRIENT_KEYS, type NutritionSource, type OptionalNutrientKey } from "../types";
import type { NutritionFormInput } from "../schemas";

import type { NutritionDraft } from "../nutrition";

const SOURCES: NutritionSource[] = ["MANUFACTURER", "LAB", "FARM_ESTIMATE", "REFERENCE"];

/** A number input that keeps what is typed ("8.", "0.") as text and only reports parsed numbers, so a
 * controlled numeric prop never eats the decimal point mid-typing. Re-syncs when the parent changes
 * the value from outside (e.g. "copy from catalogue"). */
function NumField({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: number | null | undefined;
  onChange: (next: number | undefined) => void;
  error?: string;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    // The parent changed the value from outside (not through this input) — re-sync the text, but
    // leave a partially-typed "8." alone when it already parses to the same number.
    setSeen(value);
    const parsed = text === "" ? undefined : Number(text);
    if (parsed !== (value ?? undefined)) setText(value == null ? "" : String(value));
  }
  return (
    <LabeledInput
      id={id}
      type="number"
      inputMode="decimal"
      min={0}
      step="0.01"
      label={label}
      value={text}
      error={error}
      onChange={(event) => {
        setText(event.target.value);
        onChange(event.target.value === "" ? undefined : Number(event.target.value));
      }}
    />
  );
}

/**
 * Nutrition profile fields (ADR-026): the three required nutrients up front, the rest in a collapsible
 * "more nutrients" block, all as % of dry matter unless stated. Moisture is shown as a derived readout
 * (100 − DM) — it is never entered or stored. Shared by the Add Feed Item form and the restock
 * ("Add batch") dialog. Purely controlled: the parent owns the value and maps errors by field name.
 */
export function NutritionFields({
  value,
  onChange,
  errors = {},
  idPrefix = "nutrition",
}: {
  value: NutritionDraft;
  onChange: (next: NutritionDraft) => void;
  errors?: Partial<Record<keyof NutritionFormInput, string>>;
  idPrefix?: string;
}) {
  const t = useTranslations("inventory.feed.nutrition");
  const set = <K extends keyof NutritionFormInput>(key: K, next: NutritionDraft[K]) => onChange({ ...value, [key]: next });
  const moisture = value.dmPct != null && value.dmPct >= 0 && value.dmPct <= 100 ? Math.round((100 - value.dmPct) * 100) / 100 : null;
  const hasOptional = OPTIONAL_NUTRIENT_KEYS.some((key) => value[key] != null);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        <NumField id={`${idPrefix}-dm`} label={t("dm")} value={value.dmPct} onChange={(v) => set("dmPct", v)} error={errors.dmPct} />
        <NumField id={`${idPrefix}-cp`} label={t("cp")} value={value.cpPct} onChange={(v) => set("cpPct", v)} error={errors.cpPct} />
        <NumField id={`${idPrefix}-me`} label={t("me")} value={value.meMjPerKgDm} onChange={(v) => set("meMjPerKgDm", v)} error={errors.meMjPerKgDm} />
      </div>
      <p className="text-xs text-muted-foreground">
        {moisture != null ? t("moistureDerived", { pct: moisture }) : t("moistureHint")}
      </p>

      <details className="group rounded-xl border border-border px-3 py-2" open={hasOptional}>
        <summary className="cursor-pointer select-none text-sm font-medium text-foreground">{t("moreNutrients")}</summary>
        <p className="pt-2 text-xs text-muted-foreground">{t("moreNutrientsHint")}</p>
        <div className="grid grid-cols-2 gap-3 pt-3 sm:grid-cols-3">
          {OPTIONAL_NUTRIENT_KEYS.map((key: OptionalNutrientKey) => (
            <NumField
              key={key}
              id={`${idPrefix}-${key}`}
              label={t(`fields.${key}`)}
              value={value[key]}
              onChange={(v) => set(key, v)}
              error={errors[key]}
            />
          ))}
        </div>
      </details>

      <Select value={value.nutritionSource ?? "FARM_ESTIMATE"} onValueChange={(v) => set("nutritionSource", v as NutritionSource)}>
        <LabeledSelectTrigger label={t("source")} />
        <SelectContent>
          {SOURCES.map((source) => (
            <SelectItem key={source} value={source}>
              {t(`sources.${source}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
