"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { qk } from "@/lib/query/keys";
import { cn } from "@/lib/utils";
import { cattleApi } from "@/features/cattle/api";
import { FormSheet } from "@/components/shared/form-sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useCreateHealthCase, useCreateHealthCasesBulk, useOpenCasesForCattle } from "../hooks/use-health";
import { reportSicknessSchema, type ReportSicknessInput } from "../schemas";
import type { BulkCreateHealthCasesResult, CaseManageTab, HealthCondition } from "../types";
import { AnimalMultiPicker, type PickedAnimal } from "./animal-multi-picker";
import { SymptomChips } from "./symptom-chips";
import { ConditionChips } from "./report-sickness/condition-chips";
import { PrioritySegmented } from "./report-sickness/priority-segmented";
import { AppetiteField, TemperatureField } from "./report-sickness/vitals-fields";
import { findBlockingCase, OpenCaseGuard } from "./report-sickness/open-case-guard";
import { NextStepCard } from "./report-sickness/next-step-card";
import { BulkResultCard } from "./report-sickness/bulk-result-card";

/** Conditions where milk from the cow is usually affected — a one-line nudge, never a block. */
const MILK_AFFECTING: HealthCondition[] = ["MASTITIS", "METRITIS"];

interface CreatedCase {
  id: string;
  animalName: string;
  condition: HealthCondition | undefined;
  startProtocol: boolean;
}

interface CreatedBulk {
  result: BulkCreateHealthCasesResult;
  condition: HealthCondition;
  selected: Map<string, PickedAnimal>;
}

const blankToUndefined = (value: string | undefined) => (value && value.trim() ? value.trim() : undefined);

/** "Report Sickness" (RFE-133, EPIC_HEALTH_CENTER D1/D2). Three required inputs — animals, condition chip, priority —
 * with signs/vitals and details one tap further; an open-case guard before anything is typed; and after saving the
 * sheet becomes a next-step card (start a protocol / log the first treatment / done) instead of just closing.
 * `careType` is always `CURATIVE`: preventive work goes through protocols (RAKHAL-415), not sick cases.
 * **One picker, no mode switch**: the animal picker is multi-select (RFE-139 had a "One animal | Several animals"
 * switch). Pick one animal → the single-case form (per-animal vitals, open-case guard, `POST /health/cases`). Pick two
 * or more → the shared fields only (an outbreak: one condition, `POST /health/cases/bulk`, the server skips animals
 * that already have an open case) and a result card. Typed values survive going back and forth between 1 and 2+. */
export function ReportSicknessDialog({
  open,
  onOpenChange,
  onOpenCase,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Open an existing case in the Case Management sheet (the open-case banner, "Log first treatment"). */
  onOpenCase?: (caseId: string, tab?: CaseManageTab) => void;
}) {
  const t = useTranslations("health.reportSickness");
  const tb = useTranslations("health.reportSickness.bulk");
  const createCase = useCreateHealthCase();
  const createBulk = useCreateHealthCasesBulk();
  const [selected, setSelected] = useState<Map<string, PickedAnimal>>(new Map());
  const [created, setCreated] = useState<CreatedCase | null>(null);
  const [createdBulk, setCreatedBulk] = useState<CreatedBulk | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const form = useForm<ReportSicknessInput>({
    resolver: zodResolver(reportSicknessSchema),
    defaultValues: { cattleId: "", careType: "CURATIVE", priority: "MEDIUM", symptoms: [], note: "", staffObservation: "", assignedVet: "" },
  });

  const count = selected.size;
  const multi = count >= 2;
  const single = count === 1 ? [...selected.values()][0] : null;
  const cattleId = single?.id;
  const condition = useWatch({ control: form.control, name: "condition" });
  const openCases = useOpenCasesForCattle(cattleId);
  const blocking = findBlockingCase(openCases.data?.items ?? [], condition);
  const animalDetail = useQuery({
    queryKey: qk.cattle.detail(cattleId ?? ""),
    queryFn: () => cattleApi.findOne(cattleId as string),
    enabled: Boolean(cattleId),
    staleTime: 30_000,
  });
  const animalName = single ? (single.name ?? single.tagNumber) : "";

  function reset() {
    form.reset();
    setSelected(new Map());
    setCreated(null);
    setCreatedBulk(null);
    setDetailsOpen(false);
  }

  function close(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  /** The form's `cattleId` only feeds the "an animal is required" check; the selection Map is the source of truth. */
  function onSelectionChange(next: Map<string, PickedAnimal>) {
    setSelected(next);
    const first = next.size > 0 ? next.keys().next().value : undefined;
    form.setValue("cattleId", first ?? "", { shouldValidate: form.formState.isSubmitted });
  }

  const submit = (startProtocol: boolean) =>
    form.handleSubmit(async (values) => {
      try {
        if (multi) {
          if (!values.condition) return;
          const result = await createBulk.mutateAsync({
            cattleIds: [...selected.keys()],
            condition: values.condition,
            priority: values.priority,
            careType: "CURATIVE",
            note: blankToUndefined(values.note),
            assignedVet: blankToUndefined(values.assignedVet),
            symptoms: values.symptoms?.length ? values.symptoms : undefined,
          });
          setCreatedBulk({ result, condition: values.condition, selected });
          return;
        }
        const saved = await createCase.mutateAsync({
          ...values,
          note: blankToUndefined(values.note),
          staffObservation: blankToUndefined(values.staffObservation),
          assignedVet: blankToUndefined(values.assignedVet),
          symptoms: values.symptoms?.length ? values.symptoms : undefined,
        });
        setCreated({ id: saved.id, animalName, condition: values.condition, startProtocol });
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : t("genericError"));
      }
    });

  function openCase(caseId: string, tab: CaseManageTab = "overview") {
    close(false);
    onOpenCase?.(caseId, tab);
  }

  if (createdBulk) {
    return (
      <FormSheet open={open} onOpenChange={close} title={tb("result.sheetTitle")} onSubmit={() => undefined} footer={<div />}>
        <BulkResultCard result={createdBulk.result} condition={createdBulk.condition} selected={createdBulk.selected} onDone={() => close(false)} />
      </FormSheet>
    );
  }

  if (created) {
    return (
      <FormSheet
        open={open}
        onOpenChange={close}
        title={t("nextStep.sheetTitle")}
        onSubmit={() => undefined}
        footer={<div />}
      >
        <NextStepCard
          caseId={created.id}
          animalName={created.animalName}
          conditionLabel={created.condition ? t(`conditionValue.${created.condition}`) : t("nextStep.sicknessFallback")}
          condition={created.condition}
          initialProtocolOpen={created.startProtocol}
          onLogTreatment={() => openCase(created.id, "logTreatment")}
          onDone={() => close(false)}
        />
      </FormSheet>
    );
  }

  const pending = createCase.isPending || createBulk.isPending;
  const blocked = !multi && Boolean(blocking);

  return (
    <FormSheet
      open={open}
      onOpenChange={close}
      title={t("title")}
      onSubmit={() => void submit(false)()}
      pending={pending}
      footer={
        <div className="flex flex-wrap gap-3">
          <Button type="submit" className="order-first h-12 w-full sm:order-none sm:w-auto sm:flex-1" disabled={pending || blocked}>
            {pending ? "…" : multi ? tb("submit", { count }) : t("submit")}
          </Button>
          {multi ? null : (
            <Button type="button" variant="outline" className="h-12 flex-1" onClick={() => void submit(true)()} disabled={pending || blocked}>
              {t("submitAndProtocol")}
            </Button>
          )}
          <Button type="button" variant="secondary" className="h-12 flex-1" onClick={() => close(false)} disabled={pending}>
            {t("cancel")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        <Label>{t("cattle")}</Label>
        <AnimalMultiPicker selected={selected} onChange={onSelectionChange} disabled={pending} defaultMethod="search" />
        {form.formState.errors.cattleId ? <p className="text-xs text-destructive">{t("cattleRequired")}</p> : null}
        {single && animalDetail.data ? (
          <p className="text-xs text-muted-foreground">
            {[animalDetail.data.shed?.name ?? t("noShed"), animalDetail.data.tagNumber].join(" · ")}
          </p>
        ) : null}
      </div>

      {multi ? null : <OpenCaseGuard cattleId={cattleId} condition={condition} animalName={animalName} onOpenCase={(id) => openCase(id)} />}

      <div className="flex flex-col gap-2">
        <Label>{t("condition")}</Label>
        <Controller
          control={form.control}
          name="condition"
          render={({ field }) => (
            <ConditionChips value={field.value} onChange={field.onChange} invalid={Boolean(form.formState.errors.condition)} />
          )}
        />
        {form.formState.errors.condition ? <p className="text-xs text-destructive">{t("conditionRequired")}</p> : null}
        {condition && MILK_AFFECTING.includes(condition) ? <p className="text-xs text-muted-foreground">{t("milkHint")}</p> : null}
        {multi ? <p className="text-xs text-muted-foreground">{tb("skipHint")}</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("priority")}</Label>
        <Controller control={form.control} name="priority" render={({ field }) => <PrioritySegmented value={field.value} onChange={field.onChange} />} />
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-dashed border-border p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("signsTitle")}</p>
        <div className="flex flex-col gap-2">
          <Label>{t("symptoms")}</Label>
          <Controller
            control={form.control}
            name="symptoms"
            render={({ field }) => <SymptomChips value={field.value ?? []} onChange={field.onChange} />}
          />
        </div>
        {multi ? (
          <p className="text-xs text-muted-foreground">{tb("vitalsHint")}</p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <Label>{t("temperature")}</Label>
              <Controller control={form.control} name="temperature" render={({ field }) => <TemperatureField value={field.value} onChange={field.onChange} />} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t("appetite")}</Label>
              <Controller control={form.control} name="appetite" render={({ field }) => <AppetiteField value={field.value} onChange={field.onChange} />} />
            </div>
          </>
        )}
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
            {multi ? null : (
              <div className="flex flex-col gap-2">
                <Label>{t("staffObservation")}</Label>
                <Input {...form.register("staffObservation")} placeholder={t("staffObservationPlaceholder")} />
              </div>
            )}
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
