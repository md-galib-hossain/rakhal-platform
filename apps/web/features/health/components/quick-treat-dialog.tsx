"use client"; // animal-selection state + a form + a pending mutation click

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
import { AccountPicker } from "@/features/finance/components/account-picker";
import { MedicinePicker } from "./medicine-picker";
import { useRecordTreatment } from "../hooks/use-health";
import { quickTreatSchema, type QuickTreatInput } from "../schemas";
import type { MedicineOption } from "../api";

const ROUTES = ["IM", "IV", "SC", "ORAL"] as const;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const DEFAULT_VALUES: QuickTreatInput = { selectionMethod: "individual", route: "IM", treatedAt: todayIso() } as QuickTreatInput;

/**
 * RFE-108 — "Quick Treat": log a treatment for one or more animals without opening a Sick Bay case
 * first (the Herdwatch-parity flow the backend investigation named as the target — today the only
 * path is "Report Sickness" first). Calls the real `POST /health/treatments` (RAKHAL-416) once with
 * `cattleIds[]`; the backend reuses each animal's open case if one exists, else creates a
 * lightweight one — this form never sees or sends a case id. Animal selection (shed/batch/
 * individual) mirrors `apply-health-plan-dialog.tsx`'s own picker; medicine selection reuses
 * `MedicinePicker` as-is (per the ticket's own Notes — no new medicine-selection component needed).
 * The withdrawal warning is computed client-side from `medicine.{milk,meat}WithdrawalDays` using the
 * same `treatedAt + days` math the backend's `createSafetyWithdrawalIfNeeded` uses
 * (`health.service.ts:1776-1781`, confirmed by reading that method directly). `financialAccountId`
 * is required only when `medicine.costPerUnit * doseAmount > 0` — the same RD-066 rule
 * `finalize-tmr-dialog.tsx` follows, mirrored here from the backend's own `resolvedCost` guard.
 */
export function QuickTreatDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("health.quickTreat");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [medicine, setMedicine] = useState<MedicineOption | null>(null);
  const [financialAccountId, setFinancialAccountId] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const recordTreatment = useRecordTreatment();

  const form = useForm<QuickTreatInput>({
    resolver: zodResolver(quickTreatSchema),
    defaultValues: DEFAULT_VALUES,
  });
  const selectionMethod = useWatch({ control: form.control, name: "selectionMethod" });
  const shedId = useWatch({ control: form.control, name: "shedId" });
  const feedGroupId = useWatch({ control: form.control, name: "feedGroupId" });
  const treatedAt = useWatch({ control: form.control, name: "treatedAt" });
  const doseAmount = useWatch({ control: form.control, name: "doseAmount" });

  const shedsQuery = useQuery({ queryKey: ["cattle", "sheds"], queryFn: () => cattleApi.sheds(), staleTime: 60_000, enabled: open });
  const feedGroupsQuery = useQuery({ queryKey: ["cattle", "feed-groups"], queryFn: () => cattleApi.feedGroups(), staleTime: 60_000, enabled: open });
  const animalsQuery = useQuery({
    queryKey: ["cattle", "list", "quick-treat", selectionMethod, shedId, feedGroupId, search],
    queryFn: () =>
      cattleApi.list({
        shedId: selectionMethod === "shed" ? shedId : undefined,
        feedGroupId: selectionMethod === "batch" ? feedGroupId : undefined,
        search: selectionMethod === "individual" ? search || undefined : undefined,
      }),
    enabled: open && (selectionMethod === "individual" ? true : selectionMethod === "shed" ? Boolean(shedId) : Boolean(feedGroupId)),
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
      setMedicine(null);
      setFinancialAccountId(undefined);
      setSearch("");
    }
    onOpenChange(next);
  }

  const resolvedCost = medicine?.costPerUnit && doseAmount ? medicine.costPerUnit * doseAmount : 0;
  const needsPayment = resolvedCost > 0;
  const milkUntil = medicine?.milkWithdrawalDays && treatedAt ? addDaysIso(treatedAt, medicine.milkWithdrawalDays) : null;
  const meatUntil = medicine?.meatWithdrawalDays && treatedAt ? addDaysIso(treatedAt, medicine.meatWithdrawalDays) : null;

  async function onSubmit(values: QuickTreatInput) {
    if (selected.size === 0) {
      toast.error(t("noneSelectedError"));
      return;
    }
    if (!medicine) {
      toast.error(t("noMedicineError"));
      return;
    }
    if (needsPayment && !financialAccountId) {
      toast.error(t("noAccountError"));
      return;
    }
    setSubmitting(true);
    try {
      const result = await recordTreatment.mutateAsync({
        cattleIds: [...selected],
        medicineId: medicine.id,
        doseAmount: values.doseAmount,
        doseUnit: values.doseUnit,
        route: values.route,
        treatedAt: values.treatedAt,
        reason: values.reason || undefined,
        notes: values.notes || undefined,
        financialAccountId: needsPayment ? financialAccountId : undefined,
      });
      toast.success(t("treatedToast", { count: result.appliedCount }));
      handleOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
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
                    <Select value={field.value} onValueChange={field.onChange}>
                      <LabeledSelectTrigger label={t("selectShed")} placeholder={t("selectShedPlaceholder")} />
                      <SelectContent>
                        {(shedsQuery.data?.items ?? []).map((shed) => (
                          <SelectItem key={shed.id} value={shed.id}>
                            {shed.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              ) : selectionMethod === "batch" ? (
                <Controller
                  control={form.control}
                  name="feedGroupId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <LabeledSelectTrigger label={t("selectBatch")} placeholder={t("selectBatchPlaceholder")} />
                      <SelectContent>
                        {(feedGroupsQuery.data ?? []).map((group) => (
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
              <Label>{t("selectMedicine")}</Label>
              <MedicinePicker
                value={medicine}
                onValueChange={(m) => {
                  setMedicine(m);
                  if (m && !form.getValues("doseUnit")) form.setValue("doseUnit", m.unit.symbol);
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Controller
                control={form.control}
                name="doseAmount"
                render={({ field, fieldState }) => (
                  <LabeledInput
                    id="doseAmount"
                    label={t("doseAmount")}
                    type="number"
                    step="0.01"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="doseUnit"
                render={({ field, fieldState }) => (
                  <LabeledInput id="doseUnit" label={t("doseUnit")} value={field.value ?? ""} onChange={field.onChange} error={fieldState.error?.message} />
                )}
              />
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-foreground">{t("administrationRoute")}</p>
              <Controller
                control={form.control}
                name="route"
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    {ROUTES.map((route) => (
                      <button
                        key={route}
                        type="button"
                        onClick={() => field.onChange(route)}
                        className={cn(
                          "flex-1 rounded-lg border px-4 py-2 text-sm font-bold transition-colors",
                          field.value === route ? "border-primary text-primary" : "border-border text-muted-foreground",
                        )}
                      >
                        {route}
                      </button>
                    ))}
                  </div>
                )}
              />
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

            {needsPayment ? <AccountPicker value={financialAccountId} onChange={setFinancialAccountId} /> : null}
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
