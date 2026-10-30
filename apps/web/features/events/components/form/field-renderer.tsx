"use client"; // controlled inputs + live shed/group lists

import { useId } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { useAnimalGroups, useSheds } from "@/features/cattle/hooks/use-cattle";
import { useMedicineInfiniteList } from "@/features/inventory/hooks/use-inventory";
import type { FieldDef, FormValues } from "../../forms/types";
import type { FieldError } from "../../forms/definitions";

const INPUT =
  "h-12 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring sm:text-sm";

/**
 * One field of a declarative form (RFE-158/159). Labels come from `events.fields.<name>`, segmented option labels from
 * `events.options.<name>.<value>`. Text inputs are >= 16px on phones (no iOS zoom) and targets >= 44px (03 §10).
 */
export function FieldRenderer({
  field,
  value,
  onChange,
  error,
  today,
}: {
  field: FieldDef;
  value: FormValues[string];
  onChange: (value: FormValues[string]) => void;
  error?: FieldError;
  today: string;
}) {
  const t = useTranslations("events.fields");
  const tOption = useTranslations("events.options");
  // Some fields reuse an existing namespace for their option labels (the health conditions).
  const tExternal = useTranslations(field.optionLabels ?? "events.options");
  const optionLabel = (option: string) => (field.optionLabels ? tExternal(option as never) : tOption(`${field.name}.${option}` as never));
  const tForm = useTranslations("events.form");
  const id = useId();
  const label = t(field.name);
  const errorText = error ? tForm(error === "range" ? "errorRange" : "errorRequired") : null;
  const describedBy = errorText ? `${id}-error` : undefined;

  let control: React.ReactNode;
  switch (field.kind) {
    case "segmented":
      control = (
        <div role="radiogroup" aria-label={label} aria-describedby={describedBy} className="flex flex-wrap gap-2">
          {(field.options ?? []).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={value === option}
              onClick={() => onChange(option)}
              className={cn(
                "min-h-11 rounded-lg border px-3 text-sm transition-colors",
                value === option ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border text-foreground hover:bg-muted",
              )}
            >
              {optionLabel(option)}
            </button>
          ))}
        </div>
      );
      break;
    case "select":
      control = (
        <select
          id={id}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value || undefined)}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={INPUT}
        >
          <option value="">{tForm("choose")}</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {optionLabel(option)}
            </option>
          ))}
        </select>
      );
      break;
    case "number":
      control = (
        <div className="flex items-center gap-2">
          <input
            id={id}
            type="number"
            inputMode="decimal"
            min={field.min}
            max={field.max}
            step={field.step ?? "any"}
            value={typeof value === "number" ? value : ""}
            onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            className={INPUT}
          />
          {field.unit ? <span className="shrink-0 text-sm text-muted-foreground">{field.unit}</span> : null}
        </div>
      );
      break;
    case "textarea":
      control = (
        <textarea
          id={id}
          rows={3}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={cn(INPUT, "h-auto min-h-24 py-2")}
        />
      );
      break;
    case "date":
      control = (
        <DatePicker
          id={id}
          label={label}
          value={typeof value === "string" ? value : undefined}
          onChange={onChange}
          clearable
          disabledDates={field.name === "expectedCalvingDate" ? { before: new Date(`${today}T00:00:00`) } : undefined}
        />
      );
      break;
    case "bool":
      return (
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-foreground">
          <Checkbox checked={value === true} onCheckedChange={(checked) => onChange(checked === true)} />
          {label}
        </label>
      );
    case "medicine":
      control = <MedicineSelect id={id} value={value} onChange={onChange} describedBy={describedBy} />;
      break;
    case "shed":
      control = <LookupSelect id={id} kind="shed" value={value} onChange={onChange} describedBy={describedBy} />;
      break;
    case "group":
      control = <LookupSelect id={id} kind="group" value={value} onChange={onChange} describedBy={describedBy} />;
      break;
    default:
      control = (
        <input
          id={id}
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={INPUT}
        />
      );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {field.kind === "date" ? null : (
        <label htmlFor={field.kind === "segmented" ? undefined : id} className="text-sm font-medium text-foreground">
          {label}
          {field.required ? <span className="text-destructive"> *</span> : null}
        </label>
      )}
      {control}
      {errorText ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {errorText}
        </p>
      ) : null}
    </div>
  );
}

/** Inventory medicine picker: a live health entry deducts stock, so the server needs the medicine id. */
function MedicineSelect({
  id,
  value,
  onChange,
  describedBy,
}: {
  id: string;
  value: FormValues[string];
  onChange: (value: FormValues[string]) => void;
  describedBy?: string;
}) {
  const tForm = useTranslations("events.form");
  const list = useMedicineInfiniteList({});
  return (
    <select
      id={id}
      value={typeof value === "string" ? value : ""}
      onChange={(event) => onChange(event.target.value || undefined)}
      aria-describedby={describedBy}
      className={INPUT}
    >
      <option value="">{tForm("choose")}</option>
      {list.items.map((medicine) => (
        <option key={medicine.id} value={medicine.id}>
          {medicine.name}
        </option>
      ))}
    </select>
  );
}

function LookupSelect({
  id,
  kind,
  value,
  onChange,
  describedBy,
}: {
  id: string;
  kind: "shed" | "group";
  value: FormValues[string];
  onChange: (value: FormValues[string]) => void;
  describedBy?: string;
}) {
  const tForm = useTranslations("events.form");
  const sheds = useSheds();
  const groups = useAnimalGroups();
  const rows = kind === "shed" ? sheds.data?.items : groups.data?.items;
  return (
    <select
      id={id}
      value={typeof value === "string" ? value : ""}
      onChange={(event) => onChange(event.target.value || undefined)}
      aria-describedby={describedBy}
      className={INPUT}
    >
      <option value="">{tForm("choose")}</option>
      {(rows ?? []).map((row) => (
        <option key={row.id} value={row.id}>
          {row.name}
        </option>
      ))}
    </select>
  );
}
