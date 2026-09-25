"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRightToLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LabeledInput } from "@/components/ui/labeled-field";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { CattlePicker } from "@/components/shared/cattle-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAnimalGroups, useCattlePagedList } from "@/features/cattle/hooks/use-cattle";
import { useCattleOrGroupRequirements, useConcentrations } from "../../hooks/use-feed";
import { useCreateFeedPlan, useFeedPlan, usePreviewPlanFit, useUpdateFeedPlan } from "../../hooks/use-feed-plans";
import { feedPlanFormSchema, type FeedPlanFormInput, type FeedPlanFormValues } from "../../plans-schema";
import { feedTargetTypes } from "../../schemas";
import { RequirementTile } from "../requirement-tile";
import { fromApiRequirements } from "../../lib/formula-math";
import { useFeedItemPagedList } from "@/features/inventory/hooks/use-inventory";
import { PlanUnifiedItemPicker } from "./plan-unified-item-picker";
import { PlanMixtureTable } from "./plan-mixture-table";
import type { FeedItem } from "@/features/inventory/types";
import type { FeedConcentrationSummary } from "../../types";
import type { CreateFeedPlanPayload, FeedPlanLineInput, PreviewFitPayload, UpdateFeedPlanPayload } from "../../plans-types";

const numberField = { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) };

function StepProgress({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2].map((s) => (
        <div key={s} className={cn("h-1.5 flex-1 rounded-full", s <= step ? "bg-primary-hover" : "bg-muted")} />
      ))}
    </div>
  );
}

function PlanEditorDialogBody({
  planId,
  onOpenChange,
}: {
  planId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const tCreate = useTranslations("feed.create");
  const tEditor = useTranslations("feed.plans.editor");
  const isEdit = Boolean(planId);
  const [step, setStep] = useState<1 | 2>(1);

  const editPlan = useFeedPlan(planId ?? undefined);
  const feedItemsPaged = useFeedItemPagedList({});
  const concentrations = useConcentrations();
  const groups = useAnimalGroups();
  const createPlan = useCreateFeedPlan();
  const updatePlan = useUpdateFeedPlan();

  const form = useForm<FeedPlanFormInput, unknown, FeedPlanFormValues>({
    resolver: zodResolver(feedPlanFormSchema),
    defaultValues: {
      name: "",
      notes: "",
      targetType: "INDIVIDUAL",
      lines: [],
    },
  });

  const prefilledRef = useRef(false);
  useEffect(() => {
    if (!editPlan.data || prefilledRef.current) return;
    prefilledRef.current = true;
    const p = editPlan.data;
    form.reset({
      name: p.name,
      notes: p.notes ?? "",
      targetType: p.made_for_cattle_id ? "INDIVIDUAL" : p.made_for_animal_group_id ? "GROUP" : "HERD",
      cattleId: p.made_for_cattle_id ?? undefined,
      groupId: p.made_for_animal_group_id ?? undefined,
      lines: (p.lines ?? []).map((l) => ({
        lineType: l.line_type,
        feedItemId: l.feed_item_id ?? undefined,
        concentrationId: l.concentration_id ?? undefined,
        name: l.name ?? "",
        kgPerDay: l.kg_per_day,
      })),
    });
  }, [editPlan.data, form]);

  const targetType = form.watch("targetType");
  const cattleId = form.watch("cattleId");
  const groupId = form.watch("groupId");
  const targetWeightKg = form.watch("targetWeightKg");
  const targetMilkL = form.watch("targetMilkL");
  const lines = form.watch("lines") ?? [];

  const groupCattleQuery = useCattlePagedList(groupId ? { animalGroupId: groupId } : {});
  const groupCattle = groupCattleQuery.items;
  const groupTargetCattleId = groupCattle[0]?.id;

  const effectiveCattleId =
    targetType === "INDIVIDUAL" ? cattleId : targetType === "GROUP" ? groupTargetCattleId : undefined;

  const requirementsQuery = useCattleOrGroupRequirements({
    cattleId: effectiveCattleId,
    weightKg: targetType === "HERD" ? targetWeightKg : undefined,
    milkTargetL: targetType === "HERD" ? targetMilkL : undefined,
  });
  const requirementsResult = requirementsQuery.data ?? null;
  const requirementsApi = requirementsResult?.requirements ?? null;
  const requirements = requirementsApi ? fromApiRequirements(requirementsApi) : null;
  const dataSource = requirementsResult?.data_source ?? null;

  // Live fit query against current lines
  const validLinesForFit: FeedPlanLineInput[] = useMemo(
    () =>
      lines
        .filter((l) => l.kgPerDay > 0 && (l.lineType === "FEED_ITEM" ? !!l.feedItemId : !!l.concentrationId))
        .map((l) => ({
          lineType: l.lineType,
          ...(l.lineType === "FEED_ITEM" ? { feedItemId: l.feedItemId } : { concentrationId: l.concentrationId }),
          kgPerDay: l.kgPerDay,
        })),
    [lines],
  );

  const fitPayload: PreviewFitPayload | null = useMemo(() => {
    if (validLinesForFit.length === 0) return null;
    if (effectiveCattleId) {
      return { lines: validLinesForFit, cattleId: effectiveCattleId };
    }
    if (targetWeightKg && targetMilkL != null) {
      return {
        lines: validLinesForFit,
        manual: {
          weightKg: targetWeightKg,
          milkTargetL: targetMilkL,
          animalType: "COW",
        },
      };
    }
    return null;
  }, [validLinesForFit, effectiveCattleId, targetWeightKg, targetMilkL]);

  const previewFit = usePreviewPlanFit(fitPayload);

  function addFeedItem(item: FeedItem) {
    if (lines.some((l) => l.lineType === "FEED_ITEM" && l.feedItemId === item.id)) return;
    form.setValue("lines", [...lines, { lineType: "FEED_ITEM", feedItemId: item.id, name: item.name, kgPerDay: 1 }], {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function addRecipe(c: FeedConcentrationSummary) {
    if (lines.some((l) => l.lineType === "PREPARED" && l.concentrationId === c.id)) return;
    form.setValue("lines", [...lines, { lineType: "PREPARED", concentrationId: c.id, name: c.name, kgPerDay: 1 }], {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function removeFeedItem(feedItemId: string) {
    form.setValue(
      "lines",
      lines.filter((l) => !(l.lineType === "FEED_ITEM" && l.feedItemId === feedItemId)),
      { shouldDirty: true, shouldValidate: true },
    );
  }

  function removeRecipe(concentrationId: string) {
    form.setValue(
      "lines",
      lines.filter((l) => !(l.lineType === "PREPARED" && l.concentrationId === concentrationId)),
      { shouldDirty: true, shouldValidate: true },
    );
  }

  function removeLineIndex(index: number) {
    form.setValue(
      "lines",
      lines.filter((_, i) => i !== index),
      { shouldDirty: true, shouldValidate: true },
    );
  }

  function updateLineAmount(index: number, kgPerDay: number) {
    form.setValue(
      "lines",
      lines.map((line, i) => (i === index ? { ...line, kgPerDay } : line)),
      { shouldDirty: true, shouldValidate: true },
    );
  }

  async function goNext() {
    const fieldsToValidate: (keyof FeedPlanFormInput)[] = ["name"];
    if (targetType === "INDIVIDUAL") fieldsToValidate.push("cattleId");
    if (targetType === "GROUP") fieldsToValidate.push("groupId");
    const valid = await form.trigger(fieldsToValidate);
    if (valid) setStep(2);
  }

  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const formEl = formRef.current;
    if (!formEl) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Enter") return;
      const target = e.target as HTMLElement;
      if (target.tagName !== "INPUT") return;
      e.preventDefault();
      const selector = step === 2 ? "input[data-amount-input]" : "input:not([type=hidden]):not([disabled])";
      const inputs = Array.from(formEl!.querySelectorAll<HTMLInputElement>(selector));
      inputs[inputs.indexOf(target as HTMLInputElement) + 1]?.focus();
    }
    formEl.addEventListener("keydown", onKeyDown);
    return () => formEl.removeEventListener("keydown", onKeyDown);
  }, [step, isEdit, editPlan.isLoading]);

  async function onSubmit(values: FeedPlanFormValues) {
    if (step !== 2) return;
    try {
      const payload: CreateFeedPlanPayload | UpdateFeedPlanPayload = {
        name: values.name,
        notes: values.notes?.trim() || undefined,
        madeForCattleId: values.targetType === "INDIVIDUAL" ? values.cattleId : undefined,
        madeForAnimalGroupId: values.targetType === "GROUP" ? values.groupId : undefined,
        lines: values.lines.map((l) => ({
          lineType: l.lineType,
          ...(l.lineType === "FEED_ITEM" ? { feedItemId: l.feedItemId } : { concentrationId: l.concentrationId }),
          kgPerDay: l.kgPerDay,
        })),
      };

      if (isEdit && planId) {
        await updatePlan.mutateAsync({ id: planId, dto: payload });
        toast.success(tEditor("saved"));
      } else {
        await createPlan.mutateAsync(payload as CreateFeedPlanPayload);
        toast.success(tEditor("saved"));
      }
      form.reset();
      setStep(1);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        form.setError("name", { message: "nameTaken" });
        setStep(1);
      } else {
        toast.error(err instanceof ApiError ? err.message : tEditor("genericError"));
      }
    }
  }

  const errText = (key: string | undefined) => (key ? tEditor(`errors.${key}` as never) : undefined);

  return (
    <SheetContent
      showClose={false}
      onInteractOutside={(event) => {
        if (event.detail.originalEvent.type === "focusin") event.preventDefault();
      }}
      className={cn(
        "inset-y-2.5 right-2.5 flex h-[calc(100vh-20px)] flex-col gap-0 rounded-[20px] border-2 border-border p-5 shadow-2xl transition-[left,max-width] duration-200",
        step === 1
          ? "left-auto w-[calc(100%-20px)] max-w-[640px] sm:max-w-[640px]"
          : "left-2.5 w-auto max-w-none sm:max-w-none lg:left-[16.25rem]",
      )}
    >
      <div className="flex items-start justify-between pb-5">
        <SheetTitle className="text-xl font-bold text-foreground">
          {isEdit ? tEditor("editTitle") : tEditor("createTitle")}
        </SheetTitle>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label={tCreate("close")}
          className="flex size-5 shrink-0 items-center justify-center text-foreground transition-opacity hover:opacity-70"
        >
          <ArrowRightToLine className="size-5" aria-hidden />
        </button>
      </div>
      <div className="border-t border-dashed border-border" />

      {isEdit && editPlan.isLoading ? (
        <div className="flex-1 overflow-y-auto px-1 py-4">
          <CardSkeleton lines={6} />
        </div>
      ) : (
        <form ref={formRef} onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1 py-4">
            <div className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">{tCreate("stepOf", { step, total: 2 })}</p>
              <StepProgress step={step} />
            </div>

            {step === 1 ? (
              <div className="flex flex-col gap-5">
                <LabeledInput
                  id="name"
                  label={tEditor("name")}
                  placeholder={tCreate("feedNamePlaceholder")}
                  {...form.register("name")}
                  error={errText(form.formState.errors.name?.message)}
                />

                <LabeledInput
                  id="notes"
                  label={tEditor("notes")}
                  placeholder={tEditor("notes")}
                  {...form.register("notes")}
                />

                <div className="flex h-12 gap-1 rounded-xl border border-border bg-muted p-1">
                  {feedTargetTypes.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        form.setValue("targetType", value);
                        if (value !== "INDIVIDUAL") form.setValue("cattleId", undefined);
                        if (value !== "GROUP") form.setValue("groupId", undefined);
                      }}
                      className={cn(
                        "flex flex-1 items-center justify-center rounded-lg text-sm font-bold transition-colors",
                        targetType === value ? "bg-card text-primary shadow-xs" : "text-muted-foreground",
                      )}
                    >
                      {tCreate(`targetType.${value}`)}
                    </button>
                  ))}
                </div>

                {targetType === "INDIVIDUAL" ? (
                  <Controller
                    control={form.control}
                    name="cattleId"
                    render={({ field }) => (
                      <div className="flex flex-col gap-1.5">
                        <p className="text-xs text-muted-foreground">{tCreate("selectAnimal")}</p>
                        <CattlePicker value={field.value} onValueChange={(id) => field.onChange(id)} />
                      </div>
                    )}
                  />
                ) : targetType === "GROUP" ? (
                  <Controller
                    control={form.control}
                    name="groupId"
                    render={({ field }) => (
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-1.5">
                          <p className="text-xs text-muted-foreground">{tCreate("selectGroup")}</p>
                          <Select value={field.value ?? ""} onValueChange={(id) => field.onChange(id)}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder={tCreate("selectGroup")} />
                            </SelectTrigger>
                            <SelectContent>
                              {(groups.data?.items ?? []).map((g) => (
                                <SelectItem key={g.id} value={g.id}>
                                  {g.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {field.value && (
                          <p className="text-xs text-muted-foreground">
                            {groupCattle.length > 0
                              ? tCreate("cowCount", { count: groupCattle.length })
                              : tCreate("herdTargetHint")}
                          </p>
                        )}
                      </div>
                    )}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">{tCreate("herdTargetHint")}</p>
                )}

                {form.formState.errors.cattleId ? (
                  <p className="-mt-3 text-sm text-destructive">{form.formState.errors.cattleId.message}</p>
                ) : null}
                {form.formState.errors.groupId ? (
                  <p className="-mt-3 text-sm text-destructive">{form.formState.errors.groupId.message}</p>
                ) : null}

                {/* Only show manual inputs when in HERD mode */}
                {targetType === "HERD" ? (
                  <div className="flex gap-4">
                    <LabeledInput
                      id="targetWeightKg"
                      type="number"
                      step="0.01"
                      min={1}
                      label={tCreate("avgWeight")}
                      {...form.register("targetWeightKg", numberField)}
                    />
                    <LabeledInput
                      id="targetMilkL"
                      type="number"
                      step="0.01"
                      min={0}
                      label={tCreate("avgMilkTarget")}
                      {...form.register("targetMilkL", numberField)}
                    />
                  </div>
                ) : null}

                {requirements ? (
                  <div className="flex flex-col gap-4 rounded-2xl border border-border bg-muted p-5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-muted-foreground">{tCreate("estimatedRequirements")}</p>
                      {dataSource ? (
                        <p className="text-xs text-muted-foreground">
                          {tCreate("dataSourceWeight")}: {tCreate(`dataSource.${dataSource.weight}`)} ·{" "}
                          {tCreate("dataSourceMilk")}: {tCreate(`dataSource.${dataSource.milk_yield}`)}
                        </p>
                      ) : null}
                    </div>
                    {dataSource?.weight === "assumed_zero" || dataSource?.milk_yield === "assumed_zero" ? (
                      <p className="text-xs text-warning">{tCreate("assumedZeroWarning")}</p>
                    ) : null}
                    <div className="grid grid-cols-5 gap-4 text-center">
                      <RequirementTile
                        label={tCreate("dm")}
                        value={requirements.dmKg}
                        unit={tCreate("kgPerDay")}
                        tone="foreground"
                      />
                      <RequirementTile
                        label={tCreate("protein")}
                        value={requirements.cpKg}
                        unit={tCreate("kgPerDay")}
                        tone="info"
                      />
                      <RequirementTile
                        label={tCreate("energy")}
                        value={requirements.meMj}
                        unit={tCreate("mjPerDay")}
                        tone="warning"
                      />
                      <RequirementTile
                        label={tCreate("fat")}
                        value={requirements.fatKg}
                        unit={tCreate("kgPerDay")}
                        tone="warning"
                      />
                      <RequirementTile
                        label={tCreate("fiber")}
                        value={requirements.ndfKg}
                        unit={tCreate("kgPerDay")}
                        tone="success"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {step === 2 ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-base font-medium text-foreground">{tEditor("lines")}</p>
                  <PlanUnifiedItemPicker
                    lines={lines}
                    onAddFeedItem={addFeedItem}
                    onAddRecipe={addRecipe}
                    onRemoveFeedItem={removeFeedItem}
                    onRemoveRecipe={removeRecipe}
                  />
                </div>

                {form.formState.errors.lines?.message ? (
                  <p role="alert" className="text-xs text-destructive">
                    {errText(form.formState.errors.lines.message)}
                  </p>
                ) : null}

                <PlanMixtureTable
                  lines={lines}
                  feedItems={feedItemsPaged.items ?? []}
                  concentrations={concentrations.data ?? []}
                  requirements={requirements}
                  previewFit={previewFit.data}
                  onAmountChange={updateLineAmount}
                  onRemove={removeLineIndex}
                />
              </div>
            ) : null}
          </div>

          <div className="border-t border-dashed border-border" />
          <div className="flex gap-2 pt-5">
            <Button
              type="button"
              variant="secondary"
              className="h-[52px] flex-1 rounded-xl"
              onClick={() => (step === 1 ? onOpenChange(false) : setStep(1))}
              disabled={createPlan.isPending || updatePlan.isPending}
            >
              {step === 1 ? tCreate("cancel") : tCreate("previous")}
            </Button>
            {step === 1 ? (
              <Button key="next" type="button" className="h-[52px] flex-1 rounded-xl" onClick={goNext}>
                {tCreate("next")}
              </Button>
            ) : (
              <Button
                key="save"
                type="submit"
                className="h-[52px] flex-1 rounded-xl"
                disabled={createPlan.isPending || updatePlan.isPending || lines.length === 0}
              >
                {createPlan.isPending || updatePlan.isPending ? "…" : tEditor("save")}
              </Button>
            )}
          </div>
        </form>
      )}
    </SheetContent>
  );
}

/**
 * PlanEditorSheet — 2-step Feed Plan Formulator wizard matching the Concentrate / TMR modal style.
 * Step 1: Plan details, target cow/group/herd selection & live automatic daily requirements.
 * Step 2: Full 12-nutrient feed ration lines mixture table with item picker & fit comparison.
 */
export function PlanEditorSheet({
  planId,
  open,
  onOpenChange,
}: {
  planId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      {open ? <PlanEditorDialogBody planId={planId} onOpenChange={onOpenChange} /> : null}
    </Sheet>
  );
}
