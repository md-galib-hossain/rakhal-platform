"use client"; // controlled per-animal inputs, Enter-to-next focus

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { CattleListItem } from "@/features/cattle/types";
import { VALUE_FIELD } from "../../bulk/bulk-model";
import type { FormDef } from "../../forms/types";

/**
 * One input per animal for the events whose value differs per cow (04 §6): weight and BCS take a number (decimal keypad,
 * Enter moves to the next row); a pregnancy check takes a result chosen with one tap. Empty rows are skipped by the server.
 */
export function BulkValueGrid({
  def,
  animals,
  grid,
  onChange,
}: {
  def: FormDef;
  animals: CattleListItem[];
  grid: Record<string, string>;
  onChange: (id: string, text: string) => void;
}) {
  const t = useTranslations("events.bulk");
  const tFields = useTranslations("events.fields");
  const tOption = useTranslations("events.options");
  const spec = VALUE_FIELD[def.key];
  const field = def.fields.find((f) => f.name === spec?.field);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  if (!spec || !field) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-foreground">
        {tFields(field.name)} {field.unit ? <span className="text-muted-foreground">({field.unit})</span> : null}
      </p>
      <ul className="flex flex-col gap-1.5" aria-label={t("gridLabel")}>
        {animals.map((animal, index) => (
          <li key={animal.id} className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-border px-3">
            <span className="min-w-0 truncate text-sm text-foreground">
              <span className="font-medium">{animal.tagNumber}</span>
              {animal.name ? <span className="text-muted-foreground"> {animal.name}</span> : null}
            </span>
            {spec.kind === "number" ? (
              <input
                ref={(el) => {
                  inputs.current[index] = el;
                }}
                type="number"
                inputMode="decimal"
                min={field.min}
                max={field.max}
                step={field.step ?? "any"}
                aria-label={`${tFields(field.name)} ${animal.tagNumber}`}
                value={grid[animal.id] ?? ""}
                onChange={(event) => onChange(animal.id, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  inputs.current[index + 1]?.focus();
                }}
                className="h-11 w-28 rounded-lg border border-input bg-background px-3 text-right text-base tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
              />
            ) : (
              <div role="radiogroup" aria-label={`${tFields(field.name)} ${animal.tagNumber}`} className="flex gap-1">
                {(field.options ?? []).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={grid[animal.id] === option}
                    onClick={() => onChange(animal.id, grid[animal.id] === option ? "" : option)}
                    className={cn(
                      "min-h-11 rounded-lg border px-2 text-xs transition-colors",
                      grid[animal.id] === option ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border hover:bg-muted",
                    )}
                  >
                    {tOption(`${field.name}.${option}` as never)}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
