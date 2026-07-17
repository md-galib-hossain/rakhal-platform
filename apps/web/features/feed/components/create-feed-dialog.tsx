"use client"; // multi-step wizard state + form

import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRightToLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LabeledInput, LabeledSelectTrigger } from "@/components/ui/labeled-field";
import { Select, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { CattlePicker } from "@/components/shared/cattle-picker";
import {
  useConcentrationDetail,
  useCreateConcentration,
  useFeedGroups,
  useFeedIngredients,
  useFeedRequirements,
  useNormalizeConcentration,
  useUpdateConcentration,
} from "../hooks/use-feed";
import { createFeedFormSchema, feedTargetTypes, type CreateFeedFormInput } from "../schemas";
import { FeedMixtureTable, toEffectiveMap } from "./feed-mixture-table";
import { IngredientPicker } from "./ingredient-picker";
import { RequirementTile } from "./requirement-tile";
import { fromApiRequirements } from "../lib/formula-math";
import type {
  CreateFeedConcentrationPayload,
  FeedConcentrationKind,
  UpdateFeedConcentrationPayload,
} from "../types";

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

/**
 * "Create New Feed Formulator" wizard (Figma Step 1 `1065:35227` + Step 2 `1065:35817`, file
 * `SCfMPdxP6vgW1uTxfqCtz7`). Mirrors `CreateConcentrationDto` — the "Cow Group"/"Individual Cow"
 * tab-pill (`1065:35268`) picks `targetType`, driving whether "Select Group" (`GET
 * /settings/feed-groups`) or a `CattlePicker` renders. The "Estimated Daily Requirements" box
 * (`1065:35244`) is a live `GET /feed/requirements` call keyed off Avg. Weight/Avg. Milk Target.
 * Step 2's "Add Concentrate Template" dashed placeholder (`1065:35837`) — pulling an existing
 * template's ingredient lines into a new formula — has no matching backend affordance yet (there is
 * no "duplicate a concentration's items" endpoint) and is left as a disabled placeholder rather than
 * faked; only "Add New Item" (a real ingredient picker) and "Normalize to 100%" (a real `POST
 * /feed/concentrations/normalize` call) are wired.
 *
 * Also doubles as the **edit** dialog (user request 2026-07-17, no Figma frame for an edit variant —
 * reuses this exact wizard, just prefilled): passing `editId` fetches that concentration's detail
 * (`GET /feed/concentrations/:id`), prefills every field once loaded, and submits via `PATCH`
 * (`useUpdateConcentration`) instead of `POST`. No new UI pattern, same form/validation/table.
 *
 * `kind` (user request 2026-07-18 — "Concentrate Mixer" vs "Feed Mixture" as real distinct flows,
 * see `types.ts`'s `FeedConcentrationKind` doc comment) drives which Step 1 fields render: a
 * `CONCENTRATE_TEMPLATE` shows only Name + Duration (no target-type pill, group/cattle picker,
 * weight/milk inputs, or Estimated Daily Requirements box — a template is a recipe, not a
 * cow-targeted ration). The caller always knows `kind` up front, even in edit mode — `feed-view.tsx`
 * passes the card's own `kind` (already on `FeedConcentrationSummary`) rather than waiting on the
 * detail fetch, so Step 1 renders correctly from the first frame instead of flashing the wrong shape.
 */
export function CreateFeedDialog({
  open,
  onOpenChange,
  editId,
  kind,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, edits this concentration instead of creating a new one. */
  editId?: string;
  kind: FeedConcentrationKind;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open ? <CreateFeedDialogBody onOpenChange={onOpenChange} editId={editId} kind={kind} /> : null}
    </Sheet>
  );
}

function CreateFeedDialogBody({
  onOpenChange,
  editId,
  kind,
}: {
  onOpenChange: (open: boolean) => void;
  editId?: string;
  kind: FeedConcentrationKind;
}) {
  const t = useTranslations("feed.create");
  const isEdit = Boolean(editId);
  const isTemplate = kind === "CONCENTRATE_TEMPLATE";
  const [step, setStep] = useState<1 | 2>(1);

  const feedGroups = useFeedGroups();
  const ingredients = useFeedIngredients();
  const editDetail = useConcentrationDetail(editId);
  const createConcentration = useCreateConcentration();
  const updateConcentration = useUpdateConcentration();
  const normalizeMutation = useNormalizeConcentration();

  const form = useForm<CreateFeedFormInput>({
    resolver: zodResolver(createFeedFormSchema),
    defaultValues: { kind, targetType: "GROUP", items: [] },
  });
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (!editDetail.data || prefilledRef.current) return;
    prefilledRef.current = true;
    const d = editDetail.data;
    form.reset({
      kind: d.kind,
      name: d.name,
      durationDays: d.duration_days ?? undefined,
      targetType: d.target_type,
      feedGroupId: d.feed_group_id ?? undefined,
      cattleId: d.cattle_id ?? undefined,
      targetWeightKg: d.target_weight_kg ?? undefined,
      targetMilkL: d.target_milk_l ?? undefined,
      items: d.ingredients.map((i) => ({
        ingredientId: i.ingredient_id,
        ingredientName: i.name ?? i.ingredient_id,
        amountKg: i.amount_kg,
      })),
    });
  }, [editDetail.data, form]);
  const targetType = form.watch("targetType");
  const feedGroupId = form.watch("feedGroupId");
  const targetWeightKg = form.watch("targetWeightKg");
  const targetMilkL = form.watch("targetMilkL");
  const items = form.watch("items");

  const requirementsQuery = useFeedRequirements(targetWeightKg, targetMilkL);
  const requirementsApi = requirementsQuery.data?.requirements ?? null;
  const requirements = requirementsApi ? fromApiRequirements(requirementsApi) : null;

  const effectiveById = useMemo(() => toEffectiveMap(ingredients.data ?? []), [ingredients.data]);

  const cowCount = useMemo(() => {
    if (targetType === "INDIVIDUAL") return 1;
    return feedGroups.data?.find((g) => g.id === feedGroupId)?.assigned_count || 1;
  }, [targetType, feedGroupId, feedGroups.data]);

  function addItem(ingredientId: string, ingredientName: string) {
    form.setValue("items", [...items, { ingredientId, ingredientName, amountKg: 0 }]);
  }

  function removeItem(ingredientId: string) {
    form.setValue(
      "items",
      items.filter((i) => i.ingredientId !== ingredientId),
    );
  }

  function updateAmount(ingredientId: string, amountKg: number) {
    form.setValue(
      "items",
      items.map((i) => (i.ingredientId === ingredientId ? { ...i, amountKg } : i)),
    );
  }

  async function handleNormalize() {
    if (!targetWeightKg || targetMilkL == null || items.length === 0) return;
    const result = await normalizeMutation.mutateAsync({
      weightKg: targetWeightKg,
      milkTargetL: targetMilkL,
      items: items.map((i) => ({ ingredientId: i.ingredientId, amountKg: i.amountKg })),
    });
    const nameById = new Map(items.map((i) => [i.ingredientId, i.ingredientName]));
    form.setValue(
      "items",
      result.items.map((r) => ({
        ingredientId: r.ingredient_id,
        ingredientName: nameById.get(r.ingredient_id) ?? "",
        amountKg: r.amount_kg,
      })),
    );
  }

  async function goNext() {
    const fields: (keyof CreateFeedFormInput)[] = isTemplate
      ? ["name"]
      : ["name", "targetType", "feedGroupId", "cattleId", "targetWeightKg", "targetMilkL"];
    const valid = await form.trigger(fields);
    if (valid) setStep(2);
  }

  async function onSubmit(values: CreateFeedFormInput) {
    try {
      const payload: CreateFeedConcentrationPayload | UpdateFeedConcentrationPayload = {
        kind: values.kind,
        name: values.name,
        durationDays: values.durationDays,
        targetType: isTemplate ? undefined : values.targetType,
        feedGroupId: !isTemplate && values.targetType === "GROUP" ? values.feedGroupId : undefined,
        cattleId: !isTemplate && values.targetType === "INDIVIDUAL" ? values.cattleId : undefined,
        targetWeightKg: isTemplate ? undefined : values.targetWeightKg,
        targetMilkL: isTemplate ? undefined : values.targetMilkL,
        items: values.items.map((i) => ({ ingredientId: i.ingredientId, amountKg: i.amountKg })),
      };
      if (isEdit && editId) {
        await updateConcentration.mutateAsync({ id: editId, dto: payload });
        toast.success(t("updatedToast"));
      } else {
        await createConcentration.mutateAsync(payload as CreateFeedConcentrationPayload);
        toast.success(t("createdToast"));
      }
      form.reset({ kind, targetType: "GROUP", items: [] });
      setStep(1);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <SheetContent
      showClose={false}
      className={cn(
        "inset-y-2.5 right-2.5 flex h-[calc(100vh-20px)] flex-col gap-0 rounded-[20px] border-2 border-border p-5 shadow-2xl transition-[left,max-width] duration-200",
        // Figma sizes Step 1 (`1065:35227`, a short form) as a narrow ~600px panel but Step 2
        // (`1065:35817`/`1065:35331`, the wide ingredient table) spans almost the full content
        // width up to the sidebar — confirmed via `1065:35331`'s screenshot, which shows the panel
        // in context next to the real sidebar. Same one `<Sheet>`, width just changes with `step`.
        // `SheetContent`'s own `side="right"` variant sets `sm:max-w-sm` (`sheet.tsx`) — a plain
        // unprefixed `max-w-[...]` here doesn't reliably beat that in the cascade, so the `sm:`
        // variant must be overridden explicitly too (same fix `record-transaction-dialog.tsx` needed).
        step === 1
          ? "left-auto w-[calc(100%-20px)] max-w-[640px] sm:max-w-[640px]"
          : "left-2.5 w-auto max-w-none sm:max-w-none lg:left-[16.25rem]",
      )}
    >
      <div className="flex items-start justify-between pb-5">
        <SheetTitle className="text-xl font-bold text-foreground">{t(isEdit ? "titleEdit" : "title")}</SheetTitle>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label={t("close")}
          className="flex size-5 shrink-0 items-center justify-center text-foreground transition-opacity hover:opacity-70"
        >
          <ArrowRightToLine className="size-5" aria-hidden />
        </button>
      </div>
      <div className="border-t border-dashed border-border" />

      {isEdit && editDetail.isLoading ? (
        <div className="flex-1 overflow-y-auto py-4">
          <CardSkeleton lines={6} />
        </div>
      ) : (
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto py-4">
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">{t("stepOf", { step, total: 2 })}</p>
            <StepProgress step={step} />
          </div>

          {step === 1 ? (
            <div className="flex flex-col gap-5">
              <LabeledInput id="name" label={t("feedName")} placeholder={t("feedNamePlaceholder")} {...form.register("name")} error={form.formState.errors.name?.message} />
              <LabeledInput id="durationDays" type="number" min={1} label={t("feedDuration")} {...form.register("durationDays", numberField)} />

              {!isTemplate ? (
                <>
                  <div className="flex h-12 gap-1 rounded-xl border border-border bg-muted p-1">
                    {feedTargetTypes.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          form.setValue("targetType", value);
                          form.setValue("feedGroupId", undefined);
                          form.setValue("cattleId", undefined);
                        }}
                        className={cn(
                          "flex flex-1 items-center justify-center rounded-lg text-sm font-bold transition-colors",
                          targetType === value ? "bg-card text-primary shadow-xs" : "text-muted-foreground",
                        )}
                      >
                        {t(`targetType.${value}`)}
                      </button>
                    ))}
                  </div>

                  {targetType === "GROUP" ? (
                    <Controller
                      control={form.control}
                      name="feedGroupId"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <LabeledSelectTrigger label={t("selectGroup")} placeholder={t("selectGroupPlaceholder")} className="h-11" />
                          <SelectContent>
                            {(feedGroups.data ?? []).map((group) => (
                              <SelectItem key={group.id} value={group.id}>
                                {group.name} ({t("cowCount", { count: group.assigned_count })})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  ) : (
                    <Controller
                      control={form.control}
                      name="cattleId"
                      render={({ field }) => (
                        <div className="flex flex-col gap-1.5">
                          <p className="text-xs text-muted-foreground">{t("selectAnimal")}</p>
                          <CattlePicker value={field.value} onValueChange={(id) => field.onChange(id)} />
                        </div>
                      )}
                    />
                  )}
                  {form.formState.errors.feedGroupId || form.formState.errors.cattleId ? (
                    <p className="-mt-3 text-sm text-destructive">
                      {form.formState.errors.feedGroupId?.message ?? form.formState.errors.cattleId?.message}
                    </p>
                  ) : null}

                  <div className="flex gap-4">
                    <LabeledInput
                      id="targetWeightKg"
                      type="number"
                      step="0.01"
                      min={1}
                      label={t("avgWeight")}
                      {...form.register("targetWeightKg", numberField)}
                      error={form.formState.errors.targetWeightKg?.message}
                    />
                    <LabeledInput
                      id="targetMilkL"
                      type="number"
                      step="0.01"
                      min={0}
                      label={t("avgMilkTarget")}
                      {...form.register("targetMilkL", numberField)}
                      error={form.formState.errors.targetMilkL?.message}
                    />
                  </div>

                  {requirements ? (
                    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-muted p-5">
                      <p className="text-sm text-muted-foreground">{t("estimatedRequirements")}</p>
                      <div className="grid grid-cols-4 gap-4 text-center">
                        <RequirementTile label={t("dm")} value={requirements.dmKg} unit={t("kgPerDay")} tone="foreground" />
                        <RequirementTile label={t("protein")} value={requirements.cpKg} unit={t("kgPerDay")} tone="info" />
                        <RequirementTile label={t("energy")} value={requirements.meMj} unit={t("mjPerDay")} tone="warning" />
                        <RequirementTile label={t("fiber")} value={requirements.ndfKg} unit={t("kgPerDay")} tone="success" />
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-base font-medium text-foreground">{t("feedMixture")}</p>
                <IngredientPicker excludeIds={items.map((i) => i.ingredientId)} onSelect={(o) => addItem(o.id, o.nameEn)} />
              </div>

              {items.length === 0 ? (
                <div className="flex h-24 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
                  {t("noItemsYet")}
                </div>
              ) : (
                <>
                  <FeedMixtureTable
                    items={items}
                    effectiveById={effectiveById}
                    requirements={requirements}
                    cowCount={cowCount}
                    onAmountChange={updateAmount}
                    onRemove={removeItem}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="self-end rounded-lg"
                    onClick={handleNormalize}
                    disabled={normalizeMutation.isPending}
                  >
                    {t("normalize")}
                  </Button>
                </>
              )}
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
            disabled={createConcentration.isPending || updateConcentration.isPending}
          >
            {step === 1 ? t("cancel") : t("previous")}
          </Button>
          {step === 1 ? (
            <Button type="button" className="h-[52px] flex-1 rounded-xl" onClick={goNext}>
              {t("next")}
            </Button>
          ) : (
            <Button
              type="submit"
              className="h-[52px] flex-1 rounded-xl"
              disabled={createConcentration.isPending || updateConcentration.isPending || items.length === 0}
            >
              {createConcentration.isPending || updateConcentration.isPending ? "…" : t(isEdit ? "saveFeedEdit" : "saveFeed")}
            </Button>
          )}
        </div>
      </form>
      )}
    </SheetContent>
  );
}
