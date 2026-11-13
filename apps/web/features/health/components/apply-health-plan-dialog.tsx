"use client"; // multi-step wizard + animal selection state

import { todayLocalIso } from "@/lib/local-date";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRight, ArrowRightToLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LabeledInput, LabeledSelectTrigger } from "@/components/ui/labeled-field";
import { Select, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@rakhal/ui/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cattleApi } from "@/features/cattle/api";
import type { CattleListItem } from "@/features/cattle/types";
import { useApplyPlanToAnimals, useProtocolStockCheck } from "../hooks/use-health";
import { applyHealthPlanStep1Schema, type ApplyHealthPlanStep1Input } from "../schemas";
import type { HealthPlanListItem } from "../types";
import { ProtocolPreviewTimeline } from "./protocol-preview-timeline";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@rakhal/ui/ui/label";

const ROUTES = ["IM", "IV", "SC", "ORAL"] as const;

function todayIso() {
  return todayLocalIso();
}

/**
 * "Apply Health Plan Template" 2-step wizard — Figma 734:49979 (Step 1: target-animal selection)
 * /734:50881 (Step 2: Schedule Preview), `get_design_context`. **RFE-106 (2026-09-14)**: "Confirm
 * Schedule" used to loop `createCase` → `applyToCase` once per selected animal (2N sequential
 * requests, no partial-failure handling) because the only apply route targeted one existing case.
 * Now calls the real bulk `POST /health/plans/:id/apply` once with the full `cattleIds[]`
 * (RAKHAL-414) — the backend creates a case per animal that needs one and reports each animal's
 * real outcome (`applied` or `skipped` when already on this exact protocol), so the confirmation
 * toast can say "48 applied, 2 skipped" instead of a bare count that can't tell the two apart.
 * "Shed"/"Batch" selection reuse the real `GET /sheds`/`GET /animal-groups` +
 * `GET /cattle?shedId=`/`?animalGroupId=` (same endpoints Cattle's own bulk-ops/filters use);
 * "Exclude Pregnant Animals" filters on the real `reproductiveStatus` field.
 */
export function ApplyHealthPlanDialog({ plan, onOpenChange }: { plan: HealthPlanListItem | undefined; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={Boolean(plan)} onOpenChange={onOpenChange}>
      {plan ? <ApplyHealthPlanDialogBody key={plan.id} plan={plan} onOpenChange={onOpenChange} /> : null}
    </Sheet>
  );
}

function ApplyHealthPlanDialogBody({ plan, onOpenChange }: { plan: HealthPlanListItem; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("health.healthPlan.applyDialog");
  const [step, setStep] = useState<1 | 2>(1);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const applyToAnimals = useApplyPlanToAnimals();
  // Protocols v2: the apply is blocked (409) when any medicine is short of usable stock — check it up front for the preview.
  const stockCheck = useProtocolStockCheck(plan.id, selected.size, step === 2);
  const outOfStock = stockCheck.data?.ok === false;

  const form = useForm<ApplyHealthPlanStep1Input>({
    resolver: zodResolver(applyHealthPlanStep1Schema),
    defaultValues: { selectionMethod: "shed", route: "IM", startDate: todayIso(), excludePregnant: false },
  });
  const selectionMethod = useWatch({ control: form.control, name: "selectionMethod" });
  const shedId = useWatch({ control: form.control, name: "shedId" });
  const animalGroupId = useWatch({ control: form.control, name: "animalGroupId" });
  const excludePregnant = useWatch({ control: form.control, name: "excludePregnant" });
  const startDate = useWatch({ control: form.control, name: "startDate" });

  const shedsQuery = useQuery({ queryKey: ["cattle", "sheds"], queryFn: () => cattleApi.sheds(), staleTime: 60_000 });
  const animalGroupsQuery = useQuery({ queryKey: ["cattle", "animal-groups"], queryFn: () => cattleApi.animalGroups(), staleTime: 60_000 });
  const animalsQuery = useQuery({
    queryKey: ["cattle", "list", selectionMethod, shedId, animalGroupId, search],
    queryFn: () =>
      cattleApi.list({
        shedId: selectionMethod === "shed" ? shedId : undefined,
        animalGroupId: selectionMethod === "batch" ? animalGroupId : undefined,
        search: selectionMethod === "individual" ? search || undefined : undefined,
      }),
    enabled: selectionMethod === "individual" ? true : selectionMethod === "shed" ? Boolean(shedId) : Boolean(animalGroupId),
    staleTime: 30_000,
  });

  const allAnimals: CattleListItem[] = animalsQuery.data?.items ?? [];
  const visibleAnimals = excludePregnant ? allAnimals.filter((a) => a.reproductiveStatus !== "PREGNANT") : allAnimals;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function goToPreview() {
    const valid = await form.trigger(["route", "startDate"]);
    if (!valid) return;
    if (selected.size === 0) {
      toast.error(t("noneSelectedError"));
      return;
    }
    setStep(2);
  }

  async function handleConfirm() {
    const values = form.getValues();
    setSubmitting(true);
    try {
      const result = await applyToAnimals.mutateAsync({
        planId: plan.id,
        dto: { cattleIds: [...selected], startDate: values.startDate },
      });
      if (result.skippedCount > 0) {
        toast.success(t("appliedToastWithSkipped", { applied: result.appliedCount, skipped: result.skippedCount }));
      } else {
        toast.success(t("appliedToast", { count: result.appliedCount }));
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SheetContent
      showClose={false}
      className="inset-y-2.5 right-2.5 flex h-[calc(100vh-20px)] w-[calc(100%-20px)] max-w-[600px] flex-col gap-0 rounded-[20px] border-2 border-border p-5 shadow-2xl sm:max-w-[600px]"
    >
      <div className="flex items-start justify-between pb-5">
        <SheetTitle className="text-xl font-bold text-foreground">{t("title", { name: plan.name })}</SheetTitle>
        <button type="button" onClick={() => onOpenChange(false)} aria-label={t("close")} className="flex size-5 shrink-0 items-center justify-center text-foreground transition-opacity hover:opacity-70">
          <ArrowRightToLine className="size-5" aria-hidden />
        </button>
      </div>
      <div className="border-t border-dashed border-border" />

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1 py-4">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">{t("stepOf", { step, total: 2 })}</p>
          <div className="flex items-center gap-0.5">
            <div className={cn("h-1.5 flex-1 rounded-full", "bg-primary-hover")} />
            <div className={cn("h-1.5 flex-1 rounded-full", step === 2 ? "bg-primary-hover" : "bg-muted")} />
          </div>
        </div>

        {step === 1 ? (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-base font-medium text-foreground">{t("step1Title")}</p>
              <p className="text-xs text-muted-foreground">{t("step1Subtitle")}</p>
            </div>

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
                <LabeledInput id="animalSearch" label={t("searchAnimals")} placeholder={t("searchAnimalsPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
              )}

              <div className="flex max-h-64 flex-col divide-y divide-border overflow-y-auto rounded-2xl border border-border">
                {animalsQuery.isLoading ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">{t("loadingAnimals")}</p>
                ) : visibleAnimals.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">{t("noAnimals")}</p>
                ) : (
                  visibleAnimals.map((animal) => (
                    <div key={animal.id} role="button" tabIndex={0} onClick={() => toggle(animal.id)} onKeyDown={(e) => e.key === "Enter" && toggle(animal.id)} className="flex cursor-pointer items-center gap-3 p-3">
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
            </div>

            <Controller
              control={form.control}
              name="excludePregnant"
              render={({ field }) => (
                <label className="flex w-fit cursor-pointer items-center gap-2">
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  <span className="text-sm text-foreground">{t("excludePregnant")}</span>
                </label>
              )}
            />

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

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="startDate">{t("startDate")}</Label>
              <Controller
                control={form.control}
                name="startDate"
                render={({ field, fieldState }) => (
                  <DatePicker
                    id="startDate"
                    label={t("startDate")}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-base font-medium text-foreground">{t("step2Title")}</p>
              <p className="text-xs text-muted-foreground">{t("step2Subtitle")}</p>
            </div>
            <p className="text-sm text-foreground">{t("appliesTo", { count: selected.size })}</p>
            {outOfStock ? (
              <div role="alert" className="flex flex-col gap-1 rounded-xl border border-destructive bg-destructive/10 p-3">
                <p className="text-sm font-medium text-destructive">{t("stockShortTitle")}</p>
                <ul className="list-disc pl-5 text-xs text-destructive">
                  {stockCheck.data?.shortfalls.map((s) => (
                    <li key={s.medicineId ?? s.medicineName}>{t("stockShortLine", { name: s.medicineName, needed: s.needed, available: s.available, unit: s.unit })}</li>
                  ))}
                </ul>
              </div>
            ) : stockCheck.isError ? (
              <p className="text-xs text-muted-foreground">{t("stockCheckFailed")}</p>
            ) : null}
            {/* RFE-136: real dates, when milk / meat is safe again and the notice line — same dates the backend creates. */}
            <ProtocolPreviewTimeline steps={plan.steps} startDate={startDate} kind={plan.stats?.kind} />
          </div>
        )}
      </div>

      <div className="border-t border-dashed border-border" />
      <div className="flex gap-2 pt-5">
        <Button type="button" variant="secondary" className="h-[52px] flex-1 rounded-xl" onClick={() => (step === 1 ? onOpenChange(false) : setStep(1))} disabled={submitting}>
          {step === 1 ? t("cancel") : t("back")}
        </Button>
        {step === 1 ? (
          <Button type="button" className="h-[52px] flex-1 rounded-xl" onClick={goToPreview}>
            {t("continue")}
          </Button>
        ) : (
          <Button type="button" className="h-[52px] flex-1 gap-2 rounded-xl" onClick={handleConfirm} disabled={submitting || outOfStock}>
            {submitting ? "…" : t("confirmSchedule")}
            {!submitting ? <ArrowRight className="size-[18px]" aria-hidden /> : null}
          </Button>
        )}
      </div>
    </SheetContent>
  );
}
