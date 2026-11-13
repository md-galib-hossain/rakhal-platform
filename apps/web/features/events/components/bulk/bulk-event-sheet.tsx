"use client"; // multi-step sheet state, dry run + record mutations

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { todayLocalIso } from "@/lib/local-date";
import { useCan } from "@/lib/auth/permissions";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { Button } from "@rakhal/ui/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { CattleListItem } from "@/features/cattle/types";
import { useBulkDryRun, useBulkRecord } from "../../bulk/api";
import {
  VALUE_FIELD,
  bulkEvents,
  buildBulkBodies,
  cleanValues,
  sharedDef,
  splitByEligibility,
  summarise,
  type BulkSplit,
  type BulkSummary,
} from "../../bulk/bulk-model";
import { defaultValues, FORM_DEFS, validateValues, type FieldError } from "../../forms/definitions";
import type { FormValues } from "../../forms/types";
import type { EligibilityReason, EventDef, EventKey } from "../../types";
import { FieldRenderer } from "../form/field-renderer";
import { WhenField } from "../form/when-field";
import { BulkValueGrid } from "./bulk-value-grid";

type Step = "pick" | "form" | "confirm" | "result";

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * RFE-163 — record one event for many animals (04 §6). One sheet, four steps: pick the event ("valid for X of Y"),
 * fill the shared fields (+ a per-animal value grid for weight / BCS / pregnancy check), confirm with the exact count
 * and the skip list (from `POST /animal-events/bulk?dryRun=true`), then the result. Bottom sheet on phones.
 */
export function BulkEventSheet({
  open,
  onOpenChange,
  animals,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  animals: CattleListItem[];
}) {
  const t = useTranslations("events.bulk");
  const tCatalogue = useTranslations("events.catalogue");
  const tReason = useTranslations("events.reason");
  const tChip = useTranslations("events.chip");
  const tForm = useTranslations("events.form");
  const can = useCan();
  const isPhone = useMediaQuery("(max-width: 767px)");
  const today = todayLocalIso();
  const dryRun = useBulkDryRun();
  const record = useBulkRecord();

  const [step, setStep] = useState<Step>("pick");
  const [eventKey, setEventKey] = useState<EventKey | null>(null);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState(nowTime);
  const [values, setValues] = useState<FormValues>({});
  const [grid, setGrid] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, FieldError>>({});
  const [summary, setSummary] = useState<BulkSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bodies, setBodies] = useState<ReturnType<typeof buildBulkBodies>>([]);

  const events = useMemo(() => bulkEvents((permission) => can(permission as never)), [can]);
  const rows = useMemo(() => events.map((def) => ({ def, split: splitByEligibility(def, animals) })), [events, animals]);
  const current = eventKey ? rows.find((row) => row.def.key === eventKey) : undefined;
  const formDef = eventKey ? FORM_DEFS[eventKey] : undefined;
  const shared = formDef ? sharedDef(formDef) : undefined;
  const valueSpec = eventKey ? VALUE_FIELD[eventKey] : undefined;

  function reset() {
    setStep("pick");
    setEventKey(null);
    setDate(today);
    setValues({});
    setGrid({});
    setErrors({});
    setSummary(null);
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) reset();
  }

  function choose(def: EventDef) {
    const next = FORM_DEFS[def.key];
    if (!next) return;
    setEventKey(def.key);
    setValues(defaultValues(next));
    setGrid({});
    setErrors({});
    setError(null);
    setStep("form");
  }

  function reasonText(reason: EligibilityReason): string {
    if (reason.key === "notFor") return tReason("notFor", { chip: reason.chip });
    if (reason.key === "onlyFor") return tReason("onlyFor", { chips: reason.chips.map((chip) => tChip(chip)).join(", ") });
    return tReason(reason.key);
  }

  function serverReason(code: string | undefined): string {
    if (!code) return t("skipped");
    return t.has(`skipReason.${code}` as never) ? t(`skipReason.${code}` as never) : code;
  }

  function failure(e: unknown): string {
    return e instanceof ApiError && e.status === 403 ? tForm("forbidden") : tForm("genericError");
  }

  async function toConfirm() {
    if (!formDef || !shared || !current) return;
    const found = validateValues(shared, values, { historical: false });
    const ids = current.split.valid.map((item) => item.id);
    const cleaned = valueSpec ? cleanValues(formDef, grid, ids) : null;
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const sendIds = cleaned ? Object.keys(cleaned.values) : ids;
    if (sendIds.length === 0 || (cleaned && cleaned.invalid.length > 0)) {
      setError(cleaned && cleaned.invalid.length > 0 ? t("gridInvalid", { count: cleaned.invalid.length }) : t("gridEmpty"));
      return;
    }
    setError(null);
    const built = buildBulkBodies(formDef, values, { date, time, historical: date < today }, sendIds, cleaned?.values);
    setBodies(built);
    try {
      setSummary(summarise(await dryRun.mutateAsync(built)));
      setStep("confirm");
    } catch (e) {
      setError(failure(e));
    }
  }

  async function save() {
    try {
      setSummary(summarise(await record.mutateAsync(bodies)));
      setStep("result");
    } catch (e) {
      setError(failure(e));
    }
  }

  const split: BulkSplit | undefined = current?.split;
  const title = eventKey ? tCatalogue(`${eventKey}.label` as never) : t("title");

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side={isPhone ? "bottom" : "right"}
        className={cn(
          "flex flex-col gap-0 p-4",
          isPhone ? "max-h-[92dvh] rounded-t-2xl" : "inset-y-0 right-0 h-full w-full sm:max-w-lg sm:p-5",
        )}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {step === "form" || step === "confirm" ? (
              <button
                type="button"
                aria-label={t("back")}
                onClick={() => setStep(step === "form" ? "pick" : "form")}
                className="flex size-9 items-center justify-center rounded-lg hover:bg-muted"
              >
                <ArrowLeft className="size-4" aria-hidden />
              </button>
            ) : null}
            {step === "pick" ? t("title") : title}
          </SheetTitle>
          <SheetDescription>{t("subtitle", { count: animals.length })}</SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-3">
          {step === "pick" ? (
            rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noEvents")}</p>
            ) : (
              <ul className="flex flex-col gap-2" aria-label={t("pickEvent")}>
                {rows.map(({ def, split: s }) => {
                  const disabled = s.valid.length === 0;
                  return (
                    <li key={def.key}>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => choose(def)}
                        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-border px-4 text-left transition-colors enabled:hover:bg-muted disabled:opacity-50"
                      >
                        <span className="text-sm font-medium text-foreground">{tCatalogue(`${def.key}.label` as never)}</span>
                        <span className={cn("shrink-0 text-xs tabular-nums", disabled ? "text-muted-foreground" : "text-primary")}>
                          {t("validFor", { valid: s.valid.length, total: animals.length })}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : null}

          {step === "form" && shared && split ? (
            <>
              <p className="text-sm text-muted-foreground">{t("validFor", { valid: split.valid.length, total: animals.length })}</p>
              <WhenField date={date} time={time} showTime={Boolean(shared.showTime)} today={today} onDateChange={setDate} onTimeChange={setTime} />
              {shared.fields.map((field) => (
                <FieldRenderer
                  key={field.name}
                  field={field}
                  value={values[field.name]}
                  onChange={(value) => setValues((prev) => ({ ...prev, [field.name]: value }))}
                  error={errors[field.name]}
                  today={today}
                />
              ))}
              {formDef && valueSpec ? (
                <BulkValueGrid def={formDef} animals={split.valid} grid={grid} onChange={(id, text) => setGrid((prev) => ({ ...prev, [id]: text }))} />
              ) : null}
              {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            </>
          ) : null}

          {step === "confirm" && summary && split ? (
            <>
              <p className="text-base font-semibold text-foreground">{t("confirmCount", { count: summary.eligible, event: title })}</p>
              <SkipList
                label={t("skipHeading", { count: summary.skipped.length + split.blocked.length })}
                rows={[
                  ...split.blocked.map(({ item, eligibility }) => ({ id: item.id, tag: item.tagNumber, reason: reasonText(eligibility.reason) })),
                  ...summary.skipped.map((row) => ({ id: row.cattleId, tag: row.tagNumber, reason: serverReason(row.reason) })),
                ]}
              />
              {bodies.length > 1 ? <p className="text-sm text-muted-foreground">{t("batches", { count: bodies.length })}</p> : null}
              {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            </>
          ) : null}

          {step === "result" && summary ? (
            <>
              <p className="flex items-center gap-2 text-base font-semibold text-foreground">
                <Check className="size-5 text-success" aria-hidden />
                {t("resultSaved", { count: summary.saved, event: title })}
              </p>
              <SkipList
                label={t("skipHeading", { count: summary.skipped.length })}
                rows={summary.skipped.map((row) => ({ id: row.cattleId, tag: row.tagNumber, reason: serverReason(row.reason) }))}
              />
            </>
          ) : null}
        </div>

        <div className="flex gap-2 border-t border-dashed border-border pt-3">
          {step === "form" ? (
            <Button className="min-h-11 flex-1" disabled={dryRun.isPending} onClick={() => void toConfirm()}>
              {dryRun.isPending ? t("checking") : t("review")}
            </Button>
          ) : null}
          {step === "confirm" ? (
            <Button className="min-h-11 flex-1" disabled={record.isPending || !summary || summary.eligible === 0} onClick={() => void save()}>
              {record.isPending ? tForm("saving") : t("save", { count: summary?.eligible ?? 0 })}
            </Button>
          ) : null}
          {step === "result" || step === "pick" ? (
            <Button variant="outline" className="min-h-11 flex-1" onClick={() => handleOpenChange(false)}>
              {step === "result" ? t("done") : t("cancel")}
            </Button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SkipList({ label, rows }: { label: string; rows: { id: string; tag: string; reason: string }[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2 text-sm">
        {rows.map((row) => (
          <li key={row.id} className="flex justify-between gap-3">
            <span className="font-medium text-foreground">{row.tag}</span>
            <span className="text-right text-muted-foreground">{row.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
