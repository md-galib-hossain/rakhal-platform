"use client"; // form state + mutation

import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRightToLine, Wheat } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LabeledInput, LabeledSelectTrigger } from "@/components/ui/labeled-field";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem } from "@/components/ui/select";
import { IngredientPicker } from "@/features/feed/components/ingredient-picker";
import { useFeedIngredients } from "@/features/feed/hooks/use-feed";
import { UnitPicker } from "./unit-picker";
import { useCreateFeedItem, useUpdateFeedItem } from "../hooks/use-inventory";
import { feedItemFormSchema, type FeedItemFormInput } from "../schemas";
import type { CreateFeedItemPayload, FeedItem, UpdateFeedItemPayload } from "../types";

const FEED_CLASSES = ["FORAGE", "CONCENTRATE", "MINERAL", "VITAMIN", "ADDITIVE", "OTHER"] as const;

function toCreatePayload(values: FeedItemFormInput): CreateFeedItemPayload {
  return {
    name: values.name,
    feedClass: values.feedClass,
    feedSubType: values.feedSubType,
    category: values.category || undefined,
    ingredientId: values.ingredientId,
    unitId: values.unitId,
    kgPerUnit: values.kgPerUnit,
    currentStock: values.currentStock,
    costPerUnit: values.costPerUnit,
    lowStockThreshold: values.lowStockThreshold,
    moisturePct: values.moisturePct,
    supplier: values.supplier || undefined,
    purchaseDate: values.purchaseDate,
    notes: values.notes || undefined,
  };
}

/** No `currentStock`-omission needed here unlike Medicine's `toUpdatePayload` — a feed item has no
 * separate audited adjust-stock endpoint, so `PATCH /inventory/feed-items/:id` accepts it directly
 * (`UpdateFeedItemDto`). Same shape as create, kept as its own function for symmetry with Medicine's
 * two-function pattern rather than reusing `toCreatePayload` for both. */
function toUpdatePayload(values: FeedItemFormInput): UpdateFeedItemPayload {
  return toCreatePayload(values);
}

function toFormDefaults(feedItem: FeedItem | undefined): Partial<FeedItemFormInput> {
  if (!feedItem) return { feedClass: "FORAGE", currentStock: 0, costPerUnit: 0, ingredientId: "" };
  return {
    name: feedItem.name,
    feedClass: feedItem.feedClass,
    feedSubType: feedItem.feedSubType ?? undefined,
    category: feedItem.category ?? "",
    ingredientId: feedItem.ingredientId ?? "",
    unitId: feedItem.unit.id,
    kgPerUnit: feedItem.kgPerUnit ?? undefined,
    currentStock: feedItem.currentStock,
    costPerUnit: feedItem.costPerUnit,
    lowStockThreshold: feedItem.lowStockThreshold,
    moisturePct: feedItem.moisturePct ?? undefined,
    supplier: feedItem.supplier ?? "",
    purchaseDate: feedItem.purchaseDate.slice(0, 10),
    notes: feedItem.notes ?? "",
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
 * Picking an ingredient also prefills the Feed Class from that ingredient's own `feed_class` when
 * the class hasn't been touched yet, so the two stay in sync by default without forcing it.
 */
export function FeedItemFormDialog({
  open,
  onOpenChange,
  feedItem,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feedItem?: FeedItem;
  /** Called with the newly created item right before the sheet closes. Only fires on create, not edit
   * — used by callers that need to auto-select the item they just created (e.g. Quick Feed). */
  onCreated?: (item: FeedItem) => void;
}) {
  return (
    // `modal={false}` — same fix as `create-feed-dialog.tsx`'s Sheet: the modal Dialog's
    // document-level scroll lock (`react-remove-scroll`) intercepts wheel events for anything
    // portaled outside it, including this form's `UnitPicker` popover, even with `modal={false}`
    // set on the popover itself. See that file's doc comment for the confirmed root cause.
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      {open ? (
        <FeedItemFormDialogBody key={feedItem?.id ?? "create"} onOpenChange={onOpenChange} feedItem={feedItem} onCreated={onCreated} />
      ) : null}
    </Sheet>
  );
}

function FeedItemFormDialogBody({
  onOpenChange,
  feedItem,
  onCreated,
}: {
  onOpenChange: (open: boolean) => void;
  feedItem?: FeedItem;
  onCreated?: (item: FeedItem) => void;
}) {
  const t = useTranslations("inventory.feed.form");
  const tOptions = useTranslations("inventory.feed");
  const isEdit = Boolean(feedItem);
  const createFeedItem = useCreateFeedItem();
  const updateFeedItem = useUpdateFeedItem();
  const pending = createFeedItem.isPending || updateFeedItem.isPending;
  const { data: ingredients } = useFeedIngredients();

  const form = useForm<FeedItemFormInput>({
    resolver: zodResolver(feedItemFormSchema),
    defaultValues: toFormDefaults(feedItem),
  });

  const ingredientId = form.watch("ingredientId");
  const selectedIngredientName = useMemo(
    () => ingredients?.find((ing) => ing.id === ingredientId)?.name_en,
    [ingredients, ingredientId],
  );

  async function onSubmit(values: FeedItemFormInput) {
    try {
      if (isEdit && feedItem) {
        await updateFeedItem.mutateAsync({ id: feedItem.id, dto: toUpdatePayload(values) });
      } else {
        const created = await createFeedItem.mutateAsync(toCreatePayload(values));
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
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4">
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
              <LabeledInput
                id="kgPerUnit"
                type="number"
                min={0}
                step="0.01"
                label={t("kgPerUnit")}
                className="col-span-2"
                {...form.register("kgPerUnit", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
              />
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
            <Controller
              control={form.control}
              name="feedClass"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <LabeledSelectTrigger label={t("feedClass")} />
                  <SelectContent>
                    {FEED_CLASSES.map((feedClass) => (
                      <SelectItem key={feedClass} value={feedClass}>
                        {tOptions(`classOptions.${feedClass}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <LabeledInput id="category" label={t("category")} placeholder={t("categoryPlaceholder")} {...form.register("category")} />
            <LabeledInput
              id="moisturePct"
              type="number"
              min={0}
              max={100}
              label={t("moisture")}
              {...form.register("moisturePct", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
            />
            <LabeledInput id="supplier" label={t("supplier")} placeholder={t("supplierPlaceholder")} {...form.register("supplier")} />

            <div className="col-span-2 flex flex-col gap-1.5">
              <Label>{t("ingredient")}</Label>
              <div className="flex items-center gap-2">
                <IngredientPicker
                  onSelect={(option) => {
                    form.setValue("ingredientId", option.id, { shouldValidate: true });
                    const picked = ingredients?.find((ing) => ing.id === option.id);
                    if (picked) form.setValue("feedClass", picked.feed_class);
                  }}
                  excludeIds={[]}
                  placeholder={selectedIngredientName ?? t("ingredientPlaceholder")}
                  className="w-full justify-between"
                />
              </div>
              {form.formState.errors.ingredientId ? (
                <p className="text-xs text-destructive">{t("ingredientRequired")}</p>
              ) : null}
            </div>
          </div>

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
