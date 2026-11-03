"use client"; // controlled inputs + live shed/group lists

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { useAnimalGroups, useSheds } from "@/features/cattle/hooks/use-cattle";
import { useMedicineDetail } from "@/features/inventory/hooks/use-inventory";
import { MedicinePicker } from "./medicine-picker";
import { SemenBatchPicker } from "@/features/inventory/components/semen-batch-picker";
import { useTeam } from "@/features/settings/hooks/use-team";
import { DateText } from "@/components/shared/date-text";
import { useAnimalTimeline } from "../../hooks/use-animal-timeline";
import { summariseContext } from "./event-context-card";
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
  cattleId,
  values,
  setSibling,
}: {
  cattleId?: string;
  /** All current form values + a setter for another field: lets the medicine field prefill the dose unit and the dose field
   * check the stock. Optional so callers that render a single field (bulk sheet) keep working. */
  values?: FormValues;
  setSibling?: (name: string, value: FormValues[string]) => void;
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
        <div className="flex flex-col gap-1.5">
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
        {field.name === "doseAmount" && typeof values?.medicineId === "string" && typeof value === "number" ? (
          <DoseStockWarning medicineId={values.medicineId} dose={value} />
        ) : null}
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
    case "semenBatch":
      control = <SemenBatchPicker value={typeof value === "string" ? value : undefined} onChange={onChange} error={errorText ?? undefined} />;
      break;
    case "person":
      control = <PersonField id={id} value={value} onChange={onChange} describedBy={describedBy} />;
      break;
    case "heatLink":
      return <HeatLink cattleId={cattleId} value={value} onChange={onChange} />;
    case "medicine":
      control = (
        <MedicinePicker
          id={id}
          value={typeof value === "string" ? value : undefined}
          invalid={Boolean(error)}
          describedBy={describedBy}
          onPick={(medicine) => {
            onChange(medicine?.id);
            // The dose unit follows the medicine: stock is deducted in the medicine's own unit.
            setSibling?.("doseUnit", medicine?.unit.symbol);
          }}
        />
      );
      break;
    case "shed":
      control = <LookupSelect id={id} kind="shed" value={value} onChange={onChange} describedBy={describedBy} />;
      break;
    case "group":
      control = <LookupSelect id={id} kind="group" value={value} onChange={onChange} describedBy={describedBy} />;
      break;
    default:
      if (field.name === "doseUnit" && typeof values?.medicineId === "string") {
        control = <LockedUnit id={id} value={typeof value === "string" ? value : ""} />;
        break;
      }
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
      {field.hintKey ? <p className="text-xs text-muted-foreground">{tForm(field.hintKey as never)}</p> : null}
      {errorText ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {errorText}
        </p>
      ) : null}
    </div>
  );
}

const OUTSIDE = "__outside__";

/** Inseminator: a farm member, or an outside name typed in. Both go to the server as the free-string `inseminator`. */
function PersonField({ id, value, onChange, describedBy }: { id: string; value: FormValues[string]; onChange: (value: FormValues[string]) => void; describedBy?: string }) {
  const tForm = useTranslations("events.form");
  const team = useTeam();
  const names = (team.data?.members ?? []).map((m) => m.name).filter((n): n is string => Boolean(n));
  const text = typeof value === "string" ? value : "";
  const [outside, setOutside] = useState(() => text !== "" && !names.includes(text));
  return (
    <div className="flex flex-col gap-2">
      <select
        id={id}
        value={outside ? OUTSIDE : text}
        onChange={(event) => {
          if (event.target.value === OUTSIDE) {
            setOutside(true);
            onChange(undefined);
          } else {
            setOutside(false);
            onChange(event.target.value || undefined);
          }
        }}
        aria-describedby={describedBy}
        className={INPUT}
      >
        <option value="">{tForm("choose")}</option>
        {names.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
        <option value={OUTSIDE}>{tForm("outsideInseminator")}</option>
      </select>
      {outside ? (
        <input type="text" value={text} onChange={(event) => onChange(event.target.value)} placeholder={tForm("outsideName")} aria-label={tForm("outsideName")} className={INPUT} />
      ) : null}
    </div>
  );
}

/** Display-only link to the latest heat within 48 h (no heat-event id on the breeding DTO yet: never sent). */
function HeatLink({ cattleId, value, onChange }: { cattleId?: string; value: FormValues[string]; onChange: (value: FormValues[string]) => void }) {
  const t = useTranslations("events.form");
  const timeline = useAnimalTimeline({ cattleId: cattleId ?? "", group: null, includeVoided: false });
  const [now] = useState(() => Date.now());
  const heat = summariseContext(timeline.items).lastHeatAt;
  if (!heat || now - new Date(heat).getTime() > 48 * 3_600_000) return null;
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-foreground">
      <Checkbox checked={value !== false} onCheckedChange={(checked) => onChange(checked === true)} />
      <span>
        {t("linkedToHeat")} <DateText date={heat} />
      </span>
    </label>
  );
}

/** Dose unit once a medicine is chosen: read-only, taken from the medicine (stock is deducted in that unit). */
function LockedUnit({ id, value }: { id: string; value: string }) {
  const t = useTranslations("pickers.medicine");
  return (
    <div className="flex flex-col gap-1">
      <input id={id} type="text" value={value} readOnly aria-readonly className={cn(INPUT, "cursor-not-allowed bg-muted text-muted-foreground")} />
      <p className="text-xs text-muted-foreground">{t("unitFollows")}</p>
    </div>
  );
}

/** Non-blocking heads-up when the typed dose is more than the medicine's recorded stock. */
function DoseStockWarning({ medicineId, dose }: { medicineId: string; dose: number }) {
  const t = useTranslations("pickers.medicine");
  const medicine = useMedicineDetail(medicineId);
  if (!medicine.data || dose <= medicine.data.currentStock) return null;
  return (
    <p role="alert" className="rounded-lg border border-warning/40 bg-warning-tint p-2 text-xs text-warning">
      {t("overStock", { stock: medicine.data.currentStock, unit: medicine.data.unit.symbol, dose })}
    </p>
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
