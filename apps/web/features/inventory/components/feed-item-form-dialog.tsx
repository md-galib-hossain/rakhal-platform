"use client"; // form state + mutation

import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRightToLine, Wheat } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LabeledInput, LabeledSelectTrigger } from "@/components/ui/labeled-field";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@rakhal/ui/ui/textarea";
import { Label } from "@rakhal/ui/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel } from "@/components/ui/select";
import { IngredientPicker } from "@/features/feed/components/ingredient-picker";
import { useFeedIngredients } from "@/features/feed/hooks/use-feed";
import { UnitPicker } from "./unit-picker";
import { useCreateFeedItem, useUnits, useUpdateFeedItem } from "../hooks/use-inventory";
import { FEED_CATEGORY_GROUPS, feedCategoryOption, feedCategoryValue } from "../feed-category";
import { feedItemFormSchema, type FeedItemFormInput, type NutritionFormInput } from "../schemas";
import type { CreateFeedItemPayload, FeedItem, UpdateFeedItemPayload } from "../types";
import type { FeedIngredient } from "@/features/feed/types";
import { sameMeasured, toNutritionInput, type NutritionDraft } from "../nutrition";
import { NutritionFields } from "./nutrition-fields";

/** Create body. A profile copied from the catalogue and left untouched is sent as the bare
 * `ingredientId` so the backend records the copy's provenance; anything typed or edited is sent as
 * `nutrition` (typed values win server-side, and the ingredient stays as an optional link). */
function toCreatePayload(values: FeedItemFormInput, catalogueCopy: NutritionDraft | null): CreateFeedItemPayload {
  const untouchedCopy = catalogueCopy && values.nutrition && sameMeasured(values.nutrition, catalogueCopy);
  return {
    name: values.name,
    feedClass: values.feedClass,
    feedSubType: values.feedSubType,
    ingredientId: values.ingredientId || undefined,
    nutrition: values.nutrition && !untouchedCopy ? toNutritionInput(values.nutrition) : undefined,
    batchCode: values.batchCode || undefined,
    unitId: values.unitId,
    kgPerUnit: values.kgPerUnit,
    currentStock: values.currentStock,
    costPerUnit: values.costPerUnit,
    lowStockThreshold: values.lowStockThreshold,
    supplier: values.supplier || undefined,
    purchaseDate: values.purchaseDate,
    notes: values.notes || undefined,
  };
}

/** `PATCH /inventory/feed-items/:id` (`UpdateFeedItemDto`) edits the product; a lot's nutrition is
 * revised per batch (detail sheet), so `nutrition`/`batchCode` never go on an update. */
function toUpdatePayload(values: FeedItemFormInput): UpdateFeedItemPayload {
  const { nutrition: _nutrition, batchCode: _batchCode, ...rest } = toCreatePayload(values, null);
  return rest;
}

/** Seed for a *create* opened from elsewhere (the Feed Formulator's "add to inventory" on a recipe
 * line whose ingredient isn't stocked): the ingredient's name/class and its catalogue link. */
export interface FeedItemPrefill {
  name: string;
  ingredientId?: string | null;
  feedClass?: FeedItemFormInput["feedClass"] | null;
  feedSubType?: FeedItemFormInput["feedSubType"] | null;
}

function toFormDefaults(feedItem: FeedItem | undefined, prefill?: FeedItemPrefill): Partial<FeedItemFormInput> {
  if (!feedItem) {
    return {
      currentStock: 0,
      costPerUnit: 0,
      ingredientId: prefill?.ingredientId ?? "",
      nutrition: {} as NutritionFormInput,
      ...(prefill ? { name: prefill.name } : {}),
      ...(prefill?.feedClass ? { feedClass: prefill.feedClass } : {}),
      ...(prefill?.feedSubType ? { feedSubType: prefill.feedSubType } : {}),
    };
  }
  return {
    name: feedItem.name,
    feedClass: feedItem.feedClass,
    feedSubType: feedItem.feedSubType ?? undefined,
    ingredientId: feedItem.ingredientId ?? "",
    unitId: feedItem.unit.id,
    kgPerUnit: feedItem.kgPerUnit ?? undefined,
    currentStock: feedItem.currentStock,
    costPerUnit: feedItem.costPerUnit,
    lowStockThreshold: feedItem.lowStockThreshold,
    supplier: feedItem.supplier ?? "",
    purchaseDate: feedItem.purchaseDate.slice(0, 10),
    notes: feedItem.notes ?? "",
  };
}

/** Catalogue ingredient → form draft (snake_case API → camelCase form). Unmeasured stays undefined. */
function catalogueToDraft(n: FeedIngredient["nutrition"]): NutritionDraft {
  return {
    dmPct: n.dm_pct,
    cpPct: n.cp_pct,
    meMjPerKgDm: n.me_mj_per_kg_dm,
    fatPct: n.fat_pct ?? undefined,
    ndfPct: n.ndf_pct ?? undefined,
    adfPct: n.adf_pct ?? undefined,
    rdpPct: n.rdp_pct ?? undefined,
    rupPct: n.rup_pct ?? undefined,
    starchPct: n.starch_pct ?? undefined,
    calciumPct: n.calcium_pct ?? undefined,
    phosphorusPct: n.phosphorus_pct ?? undefined,
    tdnPct: n.tdn_pct ?? undefined,
    nutritionSource: "REFERENCE",
  };
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl bg-muted px-4 py-2.5 text-sm font-semibold text-foreground">{children}</div>;
}

/** Static stand-in for the Figma "+ Add Forage Image" dropzone (732:13198) — **not** a real upload
 * control. A feed item has no photo column/endpoint at all (see `types.ts#FeedItem` doc comment),
 * unlike Medicine which got one added specifically for this modal, so wiring a clickable file
 * picker here would silently do nothing on save. Keeps the same 140px visual slot for layout
 * fidelity without implying a capability that doesn't exist. */
function PhotoPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex size-[140px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-input bg-muted text-center">
      <Wheat className="size-[18px] text-muted-foreground" aria-hidden />
      <span className="px-3 text-sm leading-tight text-muted-foreground">{label}</span>
    </div>
  );
}

/**
 * Add/Edit Feed Item drawer — Figma "Add Forage - Side Modal" (732:13198, `get_design_context`):
 * same floating-card chrome as `MedicineFormDialog`/`CattleDetailSheet` (10px inset, 20px radius,
 * 2px border, `arrow-right-03` header icon), dashed section dividers, plain-text section header
 * bands. **Real gaps vs the mock, flagged not faked**: the mock's "Item Type" selector (switching
 * between Medicine/Forage/Semen/Milk/Others) isn't built, same as Medicine's form; "Low Stock
 * Alert" is a mock dropdown ("select number") — the real `lowStockThreshold` DTO field is a plain
 * number, rendered as such. No photo upload (see `PhotoPlaceholder`).
 *
 * **"Linked Ingredient"** (`feed_taxonomy_unification`, no Figma frame — a real backend requirement
 * added when `Forage`/`FeedItem` gained a required `ingredientId` FK to the Feed Formulator's
 * `FeedIngredient` catalogue, replacing the lowercased-name match stock decrement/price-sync used
 * to rely on): reuses `features/feed`'s `IngredientPicker` (cross-feature import, same established
 * pattern as this module's `useMilkTanks()` being reused from `log-distribution-dialog.tsx`).
 * Picking an ingredient prefills the single grouped "Category" (feed class + subtype, see
 * `feed-category.ts`) from that ingredient; the user can still change it afterwards.
 */
export function FeedItemFormDialog({
  open,
  onOpenChange,
  feedItem,
  onCreated,
  prefill,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feedItem?: FeedItem;
  /** Called with the newly created item right before the sheet closes. Only fires on create, not edit
   * — used by callers that need to auto-select the item they just created (e.g. Quick Feed). */
  onCreated?: (item: FeedItem) => void;
  /** Create-mode seed (name/class/catalogue link) — ignored when editing. */
  prefill?: FeedItemPrefill;
}) {
  return (
    // `modal={false}` — same fix as `create-feed-dialog.tsx`'s Sheet: the modal Dialog's
    // document-level scroll lock (`react-remove-scroll`) intercepts wheel events for anything
    // portaled outside it, including this form's `UnitPicker` popover, even with `modal={false}`
    // set on the popover itself. See that file's doc comment for the confirmed root cause.
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      {open ? (
        <FeedItemFormDialogBody
          key={feedItem?.id ?? `create-${prefill?.ingredientId ?? prefill?.name ?? ""}`}
          onOpenChange={onOpenChange}
          feedItem={feedItem}
          onCreated={onCreated}
          prefill={prefill}
        />
      ) : null}
    </Sheet>
  );
}

function FeedItemFormDialogBody({
  onOpenChange,
  feedItem,
  onCreated,
  prefill,
}: {
  onOpenChange: (open: boolean) => void;
  feedItem?: FeedItem;
  onCreated?: (item: FeedItem) => void;
  prefill?: FeedItemPrefill;
}) {
  const t = useTranslations("inventory.feed.form");
  const tOptions = useTranslations("inventory.feed");
  const isEdit = Boolean(feedItem);
  const createFeedItem = useCreateFeedItem();
  const updateFeedItem = useUpdateFeedItem();
  const pending = createFeedItem.isPending || updateFeedItem.isPending;
  const { data: ingredients } = useFeedIngredients();
  const { data: units } = useUnits();

  const form = useForm<FeedItemFormInput>({
    resolver: zodResolver(feedItemFormSchema),
    defaultValues: toFormDefaults(feedItem, prefill),
  });

  // The values last copied from a catalogue ingredient — lets submit tell "copied and untouched"
  // (send the bare ingredient so the backend records provenance) from "copied then edited".
  const [catalogueCopy, setCatalogueCopy] = useState<NutritionDraft | null>(null);

  // A prefilled catalogue link behaves exactly like picking that ingredient in "Copy from catalogue":
  // once the catalogue has loaded, copy its nutrition so the new lot starts with real values.
  const prefilledCopyRef = useRef(false);
  useEffect(() => {
    if (feedItem || prefilledCopyRef.current || !prefill?.ingredientId || !ingredients) return;
    const picked = ingredients.find((ing) => ing.id === prefill.ingredientId);
    if (!picked) return;
    prefilledCopyRef.current = true;
    const draft = catalogueToDraft(picked.nutrition);
    setCatalogueCopy(draft);
    form.setValue("nutrition", draft as NutritionFormInput, { shouldValidate: true });
  }, [feedItem, prefill?.ingredientId, ingredients, form]);
  const ingredientId = form.watch("ingredientId");
  const selectedIngredientName = useMemo(
    () => ingredients?.find((ing) => ing.id === ingredientId)?.name_en,
    [ingredients, ingredientId],
  );

  // "Kg Per Unit" converts one unit of stock into kg for cost/feed-math (`costPerUnit / kgPerUnit`
  // and `currentStock * kgPerUnit` in `feed-item.service.ts`). For a WEIGHT-dimension unit (kg, g,
  // ton…) that conversion is already fully known from the unit catalog itself — `Unit.conversionToBase`
  // *is* "how many kg is 1 of this unit" (kg's own `conversionToBase` is 1) — so asking a farmer to
  // re-type it was pure duplicate data entry and confusion (user report 2026-09-09, first "unit is
  // kg then what kg per unit", then "still confused" after picking Gram). Only a COUNT unit (bag,
  // sack, bottle…) or a VOLUME unit (density unknown to the system) is a genuine farm-specific fact
  // this field needs a human for. `useEffect` below keeps `kgPerUnit` in lockstep with the selected
  // WEIGHT unit's `conversionToBase` (covers both a fresh pick and an edit dialog opening on an
  // already-weight-unit item, without fighting user input for COUNT/VOLUME where it stays editable).
  const unitId = form.watch("unitId");
  const selectedUnit = useMemo(() => units?.find((u) => u.id === unitId), [units, unitId]);
  const isWeightUnit = selectedUnit?.dimension === "WEIGHT";

  // `undefined` until the first time `selectedUnit` resolves (units load async) — deliberately
  // not treated as "was non-weight," so this never clears a farmer's real saved `kgPerUnit` on
  // an edit-mode COUNT/VOLUME item just because the effect hasn't run yet.
  const wasWeightUnitRef = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    if (!selectedUnit) return;
    if (isWeightUnit) {
      if (selectedUnit.conversionToBase != null) {
        form.setValue("kgPerUnit", selectedUnit.conversionToBase);
      }
    } else if (wasWeightUnitRef.current === true) {
      // Switching away from a weight unit (e.g. Ton -> Litre) — clear the auto-filled value so
      // it doesn't sit stale in the now-editable field (user report 2026-09-09: switching units
      // left the old "1000" showing).
      form.setValue("kgPerUnit", undefined);
    }
    wasWeightUnitRef.current = isWeightUnit;
  }, [isWeightUnit, selectedUnit, form]);

  async function onSubmit(values: FeedItemFormInput) {
    try {
      if (isEdit && feedItem) {
        await updateFeedItem.mutateAsync({ id: feedItem.id, dto: toUpdatePayload(values) });
      } else {
        const created = await createFeedItem.mutateAsync(toCreatePayload(values, catalogueCopy));
        onCreated?.(created);
      }
      toast.success(isEdit ? t("updatedToast") : t("createdToast"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <SheetContent
      showClose={false}
      onInteractOutside={(event) => {
        // Same focus-return fix as `create-feed-dialog.tsx` (2026-07-18 comment there): opening
        // this Sheet from a source that itself closes on click (e.g. `feeding-grid.tsx`'s item
        // `Select`, closed by picking its own "Add Feed Item" option) returns focus to that
        // trigger right after this Sheet mounts, and non-modal Dialog's `onInteractOutside`
        // misreads that focus-return as a dismiss-worthy outside interaction — flash-closing the
        // Sheet before the user ever sees it (user report 2026-09-09, "add feed item modal is not
        // rendering"). Swallow only that focus-return case; a real pointer-down/keydown outside
        // must still close it.
        if (event.detail.originalEvent.type === "focusin") event.preventDefault();
      }}
      className="inset-y-2.5 right-2.5 flex h-[calc(100vh-20px)] w-[calc(100%-20px)] max-w-[680px] flex-col gap-0 rounded-[20px] border-2 border-border p-5 shadow-2xl sm:max-w-[680px]"
    >
      <div className="flex items-center justify-between pb-5">
        <SheetTitle className="text-xl font-bold text-foreground">{isEdit ? t("editTitle") : t("createTitle")}</SheetTitle>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label={t("close")}
          className="flex size-5 items-center justify-center text-foreground transition-opacity hover:opacity-70"
        >
          <ArrowRightToLine className="size-5" aria-hidden />
        </button>
      </div>
      <div className="border-t border-dashed border-border" />

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-4">
          <SectionHeader>{t("basicInfo")}</SectionHeader>
          <div className="flex gap-4">
            <PhotoPlaceholder label={t("noPhoto")} />
            <div className="grid flex-1 grid-cols-2 gap-3">
              <LabeledInput id="name" label={t("feedName")} className="col-span-2" {...form.register("name")} error={form.formState.errors.name?.message} />
              <LabeledInput
                id="currentStock"
                type="number"
                min={0}
                step="0.01"
                label={t("currentStock")}
                {...form.register("currentStock", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
              />
              <Controller
                control={form.control}
                name="unitId"
                render={({ field, fieldState }) => (
                  <UnitPicker value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
                )}
              />
              {!isWeightUnit ? (
                <LabeledInput
                  id="kgPerUnit"
                  type="number"
                  min={0}
                  step="0.01"
                  label={t("kgPerUnit")}
                  placeholder={t("kgPerUnitHint")}
                  className="col-span-2"
                  {...form.register("kgPerUnit", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
                />
              ) : selectedUnit ? (
                // WEIGHT unit (kg, g, ton…) — the kg conversion is already known from the unit
                // itself (`Unit.conversionToBase`), so there's nothing to ask; show it instead of
                // an editable field the farmer would have no real number to put in.
                <p className="col-span-2 self-center text-xs text-muted-foreground">
                  {t("kgPerUnitAuto", {
                    unit: `${selectedUnit.name} (${selectedUnit.symbol})`,
                    kg: selectedUnit.conversionToBase ?? 1,
                  })}
                </p>
              ) : null}
              <LabeledInput
                id="costPerUnit"
                type="number"
                min={0}
                step="0.01"
                label={t("costPerUnit")}
                className="col-span-2"
                {...form.register("costPerUnit", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
              />
            </div>
          </div>

          <SectionHeader>{t("feedDetails")}</SectionHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Select
                value={feedCategoryValue(form.watch("feedClass"), form.watch("feedSubType"))}
                onValueChange={(value) => {
                  const option = feedCategoryOption(value);
                  if (!option) return;
                  form.setValue("feedClass", option.feedClass, { shouldValidate: true });
                  form.setValue("feedSubType", option.feedSubType, { shouldValidate: true });
                }}
              >
                <LabeledSelectTrigger label={t("category")} placeholder={t("categoryPlaceholder")} />
                <SelectContent>
                  {FEED_CATEGORY_GROUPS.map((group) => (
                    <SelectGroup key={group.feedClass}>
                      <SelectLabel>{tOptions(`classOptions.${group.feedClass}`)}</SelectLabel>
                      {group.options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.feedSubType
                            ? tOptions(`subTypeOptions.${option.feedSubType}`)
                            : tOptions(`categoryOptions.${option.value}`)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.feedClass ? (
                <p className="text-xs text-destructive">{t("categoryRequired")}</p>
              ) : null}
            </div>
            <LabeledInput id="supplier" label={t("supplier")} placeholder={t("supplierPlaceholder")} {...form.register("supplier")} />
            <LabeledInput id="batchCode" label={t("batchCode")} placeholder={t("batchCodePlaceholder")} {...form.register("batchCode")} />
          </div>

          <SectionHeader>{t("nutritionSection")}</SectionHeader>
          {isEdit ? (
            // Nutrition belongs to a lot, not the product — editing it is a per-batch action with its
            // own history/revert (detail sheet), so the product form never rewrites it.
            <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">{t("nutritionEditNote")}</p>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">{t("nutritionIntro")}</p>
              <div className="flex flex-col gap-1.5">
                <Label>{t("copyFromCatalogue")}</Label>
                <IngredientPicker
                  onSelect={(option) => {
                    form.setValue("ingredientId", option.id, { shouldValidate: true });
                    const picked = ingredients?.find((ing) => ing.id === option.id);
                    if (!picked) return;
                    form.setValue("feedClass", picked.feed_class, { shouldValidate: true });
                    form.setValue("feedSubType", picked.feed_sub_type ?? undefined, { shouldValidate: true });
                    const draft = catalogueToDraft(picked.nutrition);
                    setCatalogueCopy(draft);
                    form.setValue("nutrition", draft as NutritionFormInput, { shouldValidate: true });
                  }}
                  excludeIds={[]}
                  placeholder={selectedIngredientName ?? t("copyFromCataloguePlaceholder")}
                  className="w-full justify-between"
                />
                <p className="text-xs text-muted-foreground">
                  {catalogueCopy ? t("copiedHint") : t("copyFromCatalogueHint")}
                </p>
                {ingredientId ? (
                  <button
                    type="button"
                    className="self-start text-xs text-primary underline-offset-2 hover:underline"
                    onClick={() => {
                      form.setValue("ingredientId", "");
                      setCatalogueCopy(null);
                    }}
                  >
                    {t("removeCatalogueLink")}
                  </button>
                ) : null}
              </div>
              <Controller
                control={form.control}
                name="nutrition"
                render={({ field }) => {
                  const nutritionErrors = form.formState.errors.nutrition;
                  const required = t("nutritionRequired");
                  return (
                    <NutritionFields
                      value={(field.value ?? {}) as NutritionDraft}
                      onChange={(next) => field.onChange(next)}
                      errors={{
                        dmPct: nutritionErrors?.dmPct ? required : undefined,
                        cpPct: nutritionErrors?.cpPct ? required : undefined,
                        meMjPerKgDm: nutritionErrors?.meMjPerKgDm ? required : undefined,
                      }}
                    />
                  );
                }}
              />
            </div>
          )}

          <SectionHeader>{t("stockExpiry")}</SectionHeader>
          <div className="grid grid-cols-2 gap-3">
            <Controller
              control={form.control}
              name="purchaseDate"
              render={({ field, fieldState }) => (
                <DatePicker
                  id="purchaseDate"
                  label={t("purchaseDate")}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                  disabledDates={{ after: new Date() }}
                />
              )}
            />
            <LabeledInput
              id="lowStockThreshold"
              type="number"
              min={0}
              label={t("lowStockAlert")}
              {...form.register("lowStockThreshold", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
            />
          </div>

          <SectionHeader>{t("note")}</SectionHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">{t("additionalNotes")}</Label>
            <Textarea id="notes" {...form.register("notes")} />
          </div>
        </div>

        <div className="border-t border-dashed border-border" />
        <div className="flex gap-3 pt-5">
          <Button type="button" variant="secondary" className="h-12 flex-1" onClick={() => onOpenChange(false)} disabled={pending}>
            {t("cancel")}
          </Button>
          <Button type="submit" className="h-12 flex-1" disabled={pending}>
            {pending ? "…" : isEdit ? t("save") : t("add")}
          </Button>
        </div>
      </form>
    </SheetContent>
  );
}
