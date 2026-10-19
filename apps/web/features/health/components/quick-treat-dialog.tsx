"use client"; // animal-selection state + a form + a pending mutation click

import { todayLocalIso } from "@/lib/local-date";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { LabeledInput, LabeledSelectTrigger } from "@/components/ui/labeled-field";
import { Select, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { cattleApi } from "@/features/cattle/api";
import type { CattleListItem } from "@/features/cattle/types";
import { useUnits } from "@/features/inventory/hooks/use-inventory";
import { TreatmentLines } from "./treatment-lines";
import { VetCostFields } from "./vet-cost-fields";
import { CreatableSelect } from "@/components/shared/creatable-select";
import { useCreateShedInline } from "@/features/cattle/hooks/use-cattle";
import { useRecordTreatment } from "../hooks/use-health";
import { quickTreatSchema, type QuickTreatInput } from "../schemas";
import { maxWithdrawalDays, newTreatmentLine, validateTreatmentLines, type TreatmentLine, type TreatmentLineProblem } from "../treatment-lines";

function todayIso() {
  return todayLocalIso();
}

function addDaysIso(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const DEFAULT_VALUES: QuickTreatInput = { selectionMethod: "individual", treatedAt: todayIso() } as QuickTreatInput;

/**
 * RFE-108 — "Quick Treat": log a treatment for one or more animals without opening a Sick Bay case
 * first (the Herdwatch-parity flow the backend investigation named as the target — today the only
 * path is "Report Sickness" first). Calls the real `POST /health/treatments` (RAKHAL-416) once with
 * `cattleIds[]` (one call per medicine line); the backend reuses each animal's open case if one exists, else creates a
 * lightweight one — this form never sees or sends a case id. Animal selection (shed/batch/
 * individual) mirrors `apply-health-plan-dialog.tsx`'s own picker; the medicines given are a list of
 * `TreatmentLines` cards (picker + dose + unit dropdown + route each), so several go in with one save.
 * The withdrawal warning is computed client-side from `medicine.{milk,meat}WithdrawalDays` using the
 * same `treatedAt + days` math the backend's `createSafetyWithdrawalIfNeeded` uses
 * (`health.service.ts:1776-1781`, confirmed by reading that method directly), taking the longest hold
 * among the picked medicines. No payment account is asked for: a treatment's cost never touches cash
 * (RD-084 — the backend ignores `financialAccountId`; consumption posts straight to expense).
 */
export function QuickTreatDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("health.quickTreat");
  const tCattle = useTranslations("cattle.form");
  const tLines = useTranslations("health.treatmentLines");
  const createShed = useCreateShedInline();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { data: units = [] } = useUnits();
  const [lines, setLines] = useState<TreatmentLine[]>(() => [newTreatmentLine()]);
  const [lineProblems, setLineProblems] = useState<Record<string, TreatmentLineProblem> | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [vetCost, setVetCost] = useState("");
  const [vetAccountId, setVetAccountId] = useState<string | undefined>();
  const tVet = useTranslations("health.caseSheet.logTreatment");

  const recordTreatment = useRecordTreatment();

  const form = useForm<QuickTreatInput>({
    resolver: zodResolver(quickTreatSchema),
    defaultValues: DEFAULT_VALUES,
  });
  const selectionMethod = useWatch({ control: form.control, name: "selectionMethod" });
  const shedId = useWatch({ control: form.control, name: "shedId" });
  const animalGroupId = useWatch({ control: form.control, name: "animalGroupId" });
  const treatedAt = useWatch({ control: form.control, name: "treatedAt" });

  const shedsQuery = useQuery({ queryKey: ["cattle", "sheds"], queryFn: () => cattleApi.sheds(), staleTime: 60_000, enabled: open });
  const animalGroupsQuery = useQuery({ queryKey: ["cattle", "animal-groups"], queryFn: () => cattleApi.animalGroups(), staleTime: 60_000, enabled: open });
  const animalsQuery = useQuery({
    queryKey: ["cattle", "list", "quick-treat", selectionMethod, shedId, animalGroupId, search],
    queryFn: () =>
      cattleApi.list({
        shedId: selectionMethod === "shed" ? shedId : undefined,
        animalGroupId: selectionMethod === "batch" ? animalGroupId : undefined,
        search: selectionMethod === "individual" ? search || undefined : undefined,
      }),
    enabled: open && (selectionMethod === "individual" ? true : selectionMethod === "shed" ? Boolean(shedId) : Boolean(animalGroupId)),
    staleTime: 30_000,
  });
  const animals: CattleListItem[] = animalsQuery.data?.items ?? [];

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      form.reset(DEFAULT_VALUES);
      setSelected(new Set());
      setLines([newTreatmentLine()]);
      setLineProblems(undefined);
      setVetCost("");
      setVetAccountId(undefined);
      setSearch("");
    }
    onOpenChange(next);
  }

  const withdrawal = maxWithdrawalDays(lines);
  const milkUntil = withdrawal.milk > 0 && treatedAt ? addDaysIso(treatedAt, withdrawal.milk) : null;
  const meatUntil = withdrawal.meat > 0 && treatedAt ? addDaysIso(treatedAt, withdrawal.meat) : null;

  async function onSubmit(values: QuickTreatInput) {
    if (selected.size === 0) {
      toast.error(t("noneSelectedError"));
      return;
    }
    const check = validateTreatmentLines(lines);
    if (!check.ok) {
      setLineProblems(check.problems);
      toast.error(tLines("fixLines"));
      return;
    }
    const vet = Number(vetCost) > 0 ? Number(vetCost) : 0;
    if (vet > 0 && !vetAccountId) {
      toast.error(tVet("vetNeedsAccount"));
      return;
    }
    setLineProblems(undefined);
    setSubmitting(true);
    // One request per medicine (each deducts its own stock for every animal). A line that saved is dropped from the list
    // so a retry after a failure on a later line never gives the first medicine twice. The vet fee is one charge for the
    // visit, so it rides on the first request only and is cleared once that request lands.
    let remaining = lines;
    let animals = 0;
    let vetPending = vet > 0;
    try {
      for (const line of lines) {
        const manual = line.manualName !== null;
        const medicineName = manual ? line.manualName!.trim() : line.medicine!.name;
        try {
          const result = await recordTreatment.mutateAsync({
            cattleIds: [...selected],
            ...(manual ? { outsideInventory: true, medicineName } : { medicineId: line.medicine!.id }),
            doseAmount: Number(line.doseAmount),
            doseUnit: units.find((u) => u.id === line.doseUnitId)?.symbol ?? line.medicine?.unit.symbol ?? "",
            doseUnitId: line.doseUnitId,
            route: line.route,
            treatedAt: values.treatedAt,
            reason: values.reason || undefined,
            notes: values.notes || undefined,
            ...(vetPending ? { vetCost: vet, financialAccountId: vetAccountId } : {}),
          });
          animals = result.appliedCount;
          remaining = remaining.filter((l) => l.key !== line.key);
          if (vetPending) {
            vetPending = false;
            setVetCost("");
            setVetAccountId(undefined);
          }
        } catch (err) {
          setLines(remaining);
          const reason = err instanceof ApiError ? err.message : t("genericError");
          toast.error(tLines("lineFailed", { medicine: medicineName, reason }));
          if (remaining.length < lines.length) toast.success(tLines("savedCount", { count: lines.length - remaining.length }));
          return;
        }
      }
      toast.success(lines.length === 1 ? t("treatedToast", { count: animals }) : tLines("treatedMany", { animals, medicines: lines.length }));
      handleOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      {open ? (
        <SheetContent side="right" className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5 sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{t("title")}</SheetTitle>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto py-4">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-foreground">{t("selectionMethod")}</p>
              <Controller
                control={form.control}
                name="selectionMethod"
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    {(["shed", "batch", "individual"] as const).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => field.onChange(method)}
                        className={cn(
                          "flex-1 rounded-lg border px-4 py-2 text-sm font-bold transition-colors",
                          field.value === method ? "border-primary text-primary" : "border-border text-muted-foreground",
                        )}
                      >
                        {t(`selectionMethods.${method}`)}
                      </button>
                    ))}
                  </div>
                )}
              />
            </div>

            <div className="flex flex-col gap-3">
              {selectionMethod === "shed" ? (
                <Controller
                  control={form.control}
                  name="shedId"
                  render={({ field }) => (
                    <CreatableSelect
                      value={field.value}
                      onValueChange={field.onChange}
                      options={shedsQuery.data?.items ?? []}
                      trigger={<LabeledSelectTrigger label={t("selectShed")} placeholder={t("selectShedPlaceholder")} />}
                      createLabel={tCattle("addShed")}
                      namePlaceholder={tCattle("shedNamePlaceholder")}
                      createErrorMessage={tCattle("addShedError")}
                      onCreate={(name) => createShed.mutateAsync(name)}
                    />
                  )}
                />
              ) : selectionMethod === "batch" ? (
                <Controller
                  control={form.control}
                  name="animalGroupId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <LabeledSelectTrigger label={t("selectBatch")} placeholder={t("selectBatchPlaceholder")} />
                      <SelectContent>
                        {(animalGroupsQuery.data?.items ?? []).map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              ) : (
                <LabeledInput
                  id="quickTreatSearch"
                  label={t("searchAnimals")}
                  placeholder={t("searchAnimalsPlaceholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              )}

              <div className="flex max-h-48 flex-col divide-y divide-border overflow-y-auto rounded-2xl border border-border">
                {animalsQuery.isLoading ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">{t("loadingAnimals")}</p>
                ) : animals.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">{t("noAnimals")}</p>
                ) : (
                  animals.map((animal) => (
                    <div
                      key={animal.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => toggle(animal.id)}
                      onKeyDown={(e) => e.key === "Enter" && toggle(animal.id)}
                      className="flex cursor-pointer items-center gap-3 p-3"
                    >
                      <Checkbox checked={selected.has(animal.id)} onCheckedChange={() => toggle(animal.id)} onClick={(e) => e.stopPropagation()} />
                      <Avatar className="size-8">
                        <AvatarFallback>{(animal.name ?? animal.tagNumber).slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">{animal.name ?? animal.tagNumber}</span>
                        <span className="text-xs text-muted-foreground">{animal.tagNumber}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {selected.size > 0 ? <p className="text-xs text-muted-foreground">{t("selectedCount", { count: selected.size })}</p> : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label>{tLines("title")}</Label>
              <TreatmentLines lines={lines} onChange={setLines} problems={lineProblems} animalCount={selected.size || 1} allowManual disabled={submitting} />
              <VetCostFields vetCost={vetCost} setVetCost={setVetCost} accountId={vetAccountId} setAccountId={setVetAccountId} disabled={submitting} />
            </div>

            <Controller
              control={form.control}
              name="treatedAt"
              render={({ field, fieldState }) => (
                <DatePicker label={t("treatedAt")} value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />
              )}
            />

            {milkUntil || meatUntil ? (
              <div className="flex items-start gap-2 rounded-xl bg-warning-tint p-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                <p className="text-xs text-warning">
                  {t("withdrawalWarning", { count: selected.size, milkUntil: milkUntil ?? "—", meatUntil: meatUntil ?? "—" })}
                </p>
              </div>
            ) : null}

            <Controller
              control={form.control}
              name="reason"
              render={({ field }) => <LabeledInput id="reason" label={t("reason")} value={field.value ?? ""} onChange={field.onChange} />}
            />
            <Controller
              control={form.control}
              name="notes"
              render={({ field }) => <Textarea placeholder={t("notesPlaceholder")} value={field.value ?? ""} onChange={field.onChange} />}
            />
          </div>

          <SheetFooter className="border-t border-dashed border-border pt-4">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
              {t("cancel")}
            </Button>
            <Button type="button" onClick={() => void form.handleSubmit(onSubmit)()} disabled={submitting}>
              {submitting ? "…" : t("confirm")}
            </Button>
          </SheetFooter>
        </SheetContent>
      ) : null}
    </Sheet>
  );
}
