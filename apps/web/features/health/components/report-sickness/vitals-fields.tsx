"use client"; // interactive stepper + segmented control; state is owned by the parent form

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AppetiteStatus } from "../../types";

const APPETITES: AppetiteStatus[] = ["NORMAL", "REDUCED", "NONE", "HIGH"];
/** Cattle normal range is ~38.0–39.5 °C; the form accepts 35–45 (the DTO's bound). */
const TEMP_MIN = 35;
const TEMP_MAX = 45;
const TEMP_START = 38.5;
const FEVER_ABOVE = 39.5;

const clampTemp = (n: number) => Math.min(TEMP_MAX, Math.max(TEMP_MIN, Math.round(n * 10) / 10));

/** Temperature (°C) with ± steppers and a live fever hint. Empty = not measured (`undefined`). */
export function TemperatureField({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (next: number | undefined) => void;
}) {
  const t = useTranslations("health.reportSickness");
  // Free typing ("3", "38.") must not be fought by clamping — keep the raw text, push a number only when valid.
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));
  const out = value !== undefined && (value < TEMP_MIN || value > TEMP_MAX);

  function commit(text: string) {
    setDraft(text);
    if (text.trim() === "") return onChange(undefined);
    const parsed = Number(text);
    onChange(Number.isFinite(parsed) ? parsed : undefined);
  }

  function step(delta: number) {
    const base = value ?? TEMP_START;
    const next = clampTemp(base + delta);
    setDraft(String(next));
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" className="size-11 shrink-0" onClick={() => step(-0.1)} aria-label={t("temperatureDown")}>
          <Minus className="size-4" aria-hidden />
        </Button>
        <div className="relative flex-1">
          <Input
            inputMode="decimal"
            value={draft}
            onChange={(e) => commit(e.target.value)}
            placeholder="38.5"
            aria-invalid={out}
            className="h-11 pr-9 text-center"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">°C</span>
        </div>
        <Button type="button" variant="outline" size="icon" className="size-11 shrink-0" onClick={() => step(0.1)} aria-label={t("temperatureUp")}>
          <Plus className="size-4" aria-hidden />
        </Button>
      </div>
      {out ? (
        <p className="text-xs text-destructive">{t("temperatureRange", { min: TEMP_MIN, max: TEMP_MAX })}</p>
      ) : value !== undefined && value > FEVER_ABOVE ? (
        <p className="text-xs text-warning">{t("feverHint")}</p>
      ) : null}
    </div>
  );
}

export function AppetiteField({
  value,
  onChange,
}: {
  value: AppetiteStatus | undefined;
  onChange: (next: AppetiteStatus | undefined) => void;
}) {
  const t = useTranslations("health.reportSickness");
  return (
    <div role="radiogroup" aria-label={t("appetite")} className="grid grid-cols-4 gap-2">
      {APPETITES.map((appetite) => {
        const selected = value === appetite;
        return (
          <button
            key={appetite}
            type="button"
            role="radio"
            aria-checked={selected}
            // tap the selected one again to clear it — appetite is optional
            onClick={() => onChange(selected ? undefined : appetite)}
            className={cn(
              "min-h-11 rounded-lg border px-2 py-2 text-sm font-medium transition-colors",
              selected ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-foreground/30",
            )}
          >
            {t(`appetiteValue.${appetite}`)}
          </button>
        );
      })}
    </div>
  );
}
