"use client"; // selection state, a form and a mutation

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ChevronDown, ClipboardList } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { FormSheet } from "@/components/shared/form-sheet";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateHealthCasesBulk } from "../../hooks/use-health";
import { reportSicknessBulkSchema, type ReportSicknessBulkInput } from "../../schemas";
import type { BulkCreateHealthCasesResult, HealthCondition } from "../../types";
import { AnimalMultiPicker, type PickedAnimal } from "../animal-multi-picker";
import { ProtocolPicker } from "../protocol-picker";
import { SymptomChips } from "../symptom-chips";
import { ConditionChips } from "./condition-chips";
import { PrioritySegmented } from "./priority-segmented";
import { ReportModeSwitch, type ReportMode } from "./report-mode-switch";

const MILK_AFFECTING: HealthCondition[] = ["MASTITIS", "METRITIS"];
const blank = (value: string | undefined) => (value && value.trim() ? value.trim() : undefined);

const labelOf = (a: PickedAnimal) => a.name ?? a.tagNumber;

/**
 * Report Sickness → "Several animals" (RFE-139, backend RAKHAL-469): one condition for a group — an outbreak in a shed
 * or pen — in one go. Same three required inputs as the single form (animals instead of one animal, condition,
 * priority); per-animal vitals stay single-case. The server skips any animal that already has an open case for the
 * condition, so there is no open-case guard here — the result says who was skipped. After saving, the sheet becomes a
 * result card with the one follow-up that matters for an outbreak: start one protocol on all the new cases.
 */
export function BulkReportSheet({
  open,
  onClose,
  mode,
  onModeChange,
}: {
  open: boolean;
  onClose: () => void;
  mode: ReportMode;
  onModeChange: (next: ReportMode) => void;
}) {
  const t = useTranslations("health.reportSickness");
  const tb = useTranslations("health.reportSickness.bulk");
  const createBulk = useCreateHealthCasesBulk();
  const [selected, setSelected] = useState<Map<string, PickedAnimal>>(new Map());
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [done, setDone] = useState<{ result: BulkCreateHealthCasesResult; condition: HealthCondition; selected: Map<string, PickedAnimal> } | null>(null);
  const [protocolOpen, setProtocolOpen] = useState(false);
  const [noneSelected, setNoneSelected] = useState(false);
  const form = useForm<ReportSicknessBulkInput>({
    resolver: zodResolver(reportSicknessBulkSchema),
    defaultValues: { priority: "MEDIUM", symptoms: [], note: "", assignedVet: "" },
  });
  const condition = useWatch({ control: form.control, name: "condition" });

  function close() {
    form.reset();
    setSelected(new Map());
    setDetailsOpen(false);
    setDone(null);
    setProtocolOpen(false);
    setNoneSelected(false);
    onClose();
  }

  const submit = form.handleSubmit(async (values) => {
    if (selected.size === 0) {
      setNoneSelected(true);
      return;
    }
    try {
      const result = await createBulk.mutateAsync({
        cattleIds: [...selected.keys()],
        condition: values.condition,
        priority: values.priority,
        careType: "CURATIVE",
        note: blank(values.note),
        assignedVet: blank(values.assignedVet),
        symptoms: values.symptoms?.length ? values.symptoms : undefined,
      });
      setDone({ result, condition: values.condition, selected });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  });

  if (done) {
    const created = done.result.results.filter((r) => r.status === "created");
    const skipped = done.result.results.filter((r) => r.status === "skipped");
    const tagOf = (cattleId: string) => {
      const animal = done.selected.get(cattleId);
      return animal ? labelOf(animal) : cattleId;
    };
    return (
      <FormSheet open={open} onOpenChange={(next) => !next && close()} title={tb("result.sheetTitle")} onSubmit={() => undefined} footer={<div />}>
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3 rounded-xl border border-success bg-success-tint p-4">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
            <div className="flex flex-col gap-1">
              <p className="text-base font-semibold text-foreground">{tb("result.opened", { count: done.result.createdCount, condition: t(`conditionValue.${done.condition}`) })}</p>
              {created.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {created.map((r) => (
                    <Chip key={r.cattleId} variant="muted">
                      {tagOf(r.cattleId)}
                    </Chip>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {skipped.length > 0 ? (
            <div className="flex items-start gap-3 rounded-xl border border-warning bg-warning-tint p-4">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-foreground">{tb("result.skipped", { count: skipped.length })}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {skipped.map((r) => (
                    <Chip key={r.cattleId} variant="warning">
                      {tagOf(r.cattleId)}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {created.length > 0 ? (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setProtocolOpen((v) => !v)}
                aria-expanded={protocolOpen}
                className={cn(
                  "flex min-h-14 items-center gap-3 rounded-xl border p-4 text-left transition-colors",
                  protocolOpen ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30",
                )}
              >
                <ClipboardList className="size-5 shrink-0 text-primary" aria-hidden />
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">{tb("result.startProtocol")}</span>
                  <span className="text-xs text-muted-foreground">{tb("result.startProtocolHint", { count: created.length })}</span>
                </span>
              </button>
              {protocolOpen ? (
                <ProtocolPicker
                  caseIds={created.map((r) => (r.status === "created" ? r.healthCaseId : ""))}
                  condition={done.condition}
                  onApplied={() => setProtocolOpen(false)}
                />
              ) : null}
            </div>
          ) : null}

          <Button type="button" variant="primary" className="h-12" onClick={close}>
            {tb("result.done")}
          </Button>
        </div>
      </FormSheet>
    );
  }

  const pending = createBulk.isPending;
  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => !next && close()}
      title={tb("title")}
      onSubmit={() => void submit()}
      pending={pending}
      footer={
        <div className="flex flex-wrap gap-3">
          <Button type="submit" className="order-first h-12 w-full sm:order-none sm:w-auto sm:flex-1" disabled={pending}>
            {pending ? "…" : tb("submit", { count: selected.size })}
          </Button>
          <Button type="button" variant="secondary" className="h-12 flex-1" onClick={close} disabled={pending}>
            {t("cancel")}
          </Button>
        </div>
      }
    >
      <ReportModeSwitch value={mode} onChange={onModeChange} disabled={pending} />

      <div className="flex flex-col gap-2">
        <Label>{tb("animals")}</Label>
        <AnimalMultiPicker
          selected={selected}
          onChange={(next) => {
            setSelected(next);
            if (next.size > 0) setNoneSelected(false);
          }}
          disabled={pending}
        />
        {noneSelected ? <p className="text-xs text-destructive">{tb("noneSelected")}</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("condition")}</Label>
        <Controller
          control={form.control}
          name="condition"
          render={({ field }) => <ConditionChips value={field.value} onChange={field.onChange} invalid={Boolean(form.formState.errors.condition)} />}
        />
        {form.formState.errors.condition ? <p className="text-xs text-destructive">{t("conditionRequired")}</p> : null}
        {condition && MILK_AFFECTING.includes(condition) ? <p className="text-xs text-muted-foreground">{t("milkHint")}</p> : null}
        <p className="text-xs text-muted-foreground">{tb("skipHint")}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("priority")}</Label>
        <Controller control={form.control} name="priority" render={({ field }) => <PrioritySegmented value={field.value} onChange={field.onChange} />} />
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-3">
        <Label>{t("symptoms")}</Label>
        <Controller control={form.control} name="symptoms" render={({ field }) => <SymptomChips value={field.value ?? []} onChange={field.onChange} />} />
        <p className="text-xs text-muted-foreground">{tb("vitalsHint")}</p>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setDetailsOpen((v) => !v)}
          aria-expanded={detailsOpen}
          className="flex min-h-11 items-center justify-between rounded-lg px-1 text-sm font-medium text-foreground"
        >
          {t("detailsToggle")}
          <ChevronDown className={cn("size-4 transition-transform", detailsOpen && "rotate-180")} aria-hidden />
        </button>
        {detailsOpen ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>{t("note")}</Label>
              <Input {...form.register("note")} placeholder={t("notePlaceholder")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t("assignedVet")}</Label>
              <Input {...form.register("assignedVet")} placeholder={t("assignedVetPlaceholder")} />
            </div>
          </div>
        ) : null}
      </div>
    </FormSheet>
  );
}
