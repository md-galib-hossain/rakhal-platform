"use client"; // form state; hands the typed item back to the purchase line, nothing is saved here

import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { ArrowRightToLine, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@rakhal/ui/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LabeledInput, LabeledSelectTrigger } from "@/components/ui/labeled-field";
import { Select, SelectContent, SelectItem } from "@rakhal/ui/ui/select";
import { IngredientPicker } from "@/features/feed/components/ingredient-picker";
import { useFeedIngredients } from "@/features/feed/hooks/use-feed";
import { UnitPicker } from "@/features/inventory/components/unit-picker";
import { useUnits } from "@/features/inventory/hooks/use-inventory";
import type { MedicineCategory, MedicineType } from "@/features/inventory/types";
import { newItemDraftSchema, type NewItemDraft } from "../schemas";
import { PURCHASE_NEW_ITEM_KINDS, type PurchaseNewItemKind } from "../types";

const MEDICINE_TYPES: MedicineType[] = ["LIQUID", "POWDER", "TABLET", "INJECTABLE", "BOLUS", "OINTMENT", "OTHER"];
const MEDICINE_CATEGORIES: MedicineCategory[] = [
  "ANTIBIOTIC",
  "ANTIPARASITIC",
  "VACCINE",
  "VITAMIN",
  "MINERAL",
  "HORMONE",
  "ANTI_INFLAMMATORY",
  "ANALGESIC",
  "OTHER",
];

/** What the sheet returns: the typed draft plus the unit's symbol (for the line's stock chip). */
export interface NewItemResult {
  draft: NewItemDraft;
  unitSymbol: string;
}

/**
 * "+ New item" for a purchase line. Nothing is saved here — the typed item goes back to the line and
 * is sent as `newItem` on `POST /purchasing/purchases`, where the backend creates it with zero stock
 * in the same transaction as the purchase (so a failed purchase never leaves an orphan item).
 *
 * Kind decides the fields, mirroring `PurchaseNewItemDto`: Medicine = unit + type + category; Feed =
 * unit + a catalogue ingredient (the new item copies its nutrition — add a custom ingredient from the
 * picker if it is not listed); Equipment = just a name (unit optional).
 *
 * Non-modal: it opens on top of the purchase sheet (same reason as `QuickAddSupplierSheet`).
 */
export function NewItemSheet({
  open,
  onOpenChange,
  initialKind,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialKind: PurchaseNewItemKind;
  onCreate: (result: NewItemResult) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      {open ? <NewItemBody onOpenChange={onOpenChange} initialKind={initialKind} onCreate={onCreate} /> : null}
    </Sheet>
  );
}

function NewItemBody({
  onOpenChange,
  initialKind,
  onCreate,
}: {
  onOpenChange: (open: boolean) => void;
  initialKind: PurchaseNewItemKind;
  onCreate: (result: NewItemResult) => void;
}) {
  const t = useTranslations("purchasing.newItem");
  const tMedicine = useTranslations("inventory.medicine");
  const { data: units } = useUnits();
  const { data: ingredients } = useFeedIngredients();

  const form = useForm<NewItemDraft>({
    resolver: zodResolver(newItemDraftSchema),
    defaultValues: {
      kind: initialKind,
      name: "",
      medicineType: initialKind === "MEDICINE" ? "OTHER" : undefined,
      medicineCategory: initialKind === "MEDICINE" ? "OTHER" : undefined,
    },
  });
  const kind = form.watch("kind");
  const ingredientId = form.watch("ingredientId");
  const ingredientName = useMemo(() => ingredients?.find((ing) => ing.id === ingredientId)?.name_en, [ingredients, ingredientId]);

  function chooseKind(next: PurchaseNewItemKind) {
    form.setValue("kind", next);
    form.clearErrors();
    // The detail fields belong to one kind — reset them so a switch never submits a stale value.
    form.setValue("medicineType", next === "MEDICINE" ? "OTHER" : undefined);
    form.setValue("medicineCategory", next === "MEDICINE" ? "OTHER" : undefined);
    form.setValue("ingredientId", undefined);
    form.setValue("feedClass", undefined);
  }

  function onSubmit(values: NewItemDraft) {
    const unitSymbol = units?.find((u) => u.id === values.unitId)?.symbol ?? "";
    onCreate({ draft: values, unitSymbol });
    onOpenChange(false);
  }

  return (
    <SheetContent
      showClose={false}
      className="inset-y-2.5 right-2.5 flex h-[calc(100vh-20px)] w-[calc(100%-20px)] max-w-[480px] flex-col gap-0 rounded-[20px] border-2 border-border p-5 shadow-2xl sm:max-w-[480px]"
    >
      <div className="flex items-center justify-between pb-5">
        <SheetTitle className="text-xl font-bold text-foreground">{t("title")}</SheetTitle>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label={t("cancel")}
          className="flex size-5 items-center justify-center text-foreground transition-opacity hover:opacity-70"
        >
          <ArrowRightToLine className="size-5" aria-hidden />
        </button>
      </div>
      <div className="border-t border-dashed border-border" />
      <form
        onSubmit={(event) => {
          // React bubbles portal events through the React tree — keep this submit from reaching the
          // purchase form that rendered the picker.
          event.stopPropagation();
          void form.handleSubmit(onSubmit)(event);
        }}
        className="flex flex-1 flex-col overflow-y-auto"
        noValidate
      >
        <div className="flex flex-1 flex-col gap-4 px-1 py-4">
          <div role="radiogroup" aria-label={t("kindLabel")} className="grid grid-cols-3 gap-2">
            {PURCHASE_NEW_ITEM_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => chooseKind(k)}
                className={cn(
                  "h-11 rounded-lg border bg-card px-2 text-sm font-medium transition-colors",
                  kind === k ? "border-primary bg-success-tint text-primary" : "border-input text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`kind.${k}`)}
              </button>
            ))}
          </div>

          <LabeledInput id="newItemName" label={t("name")} error={form.formState.errors.name ? t("nameRequired") : undefined} {...form.register("name")} />

          <Controller
            control={form.control}
            name="unitId"
            render={({ field, fieldState }) => (
              <UnitPicker value={field.value} onChange={field.onChange} error={fieldState.error ? t("unitRequired") : undefined} />
            )}
          />

          {kind === "MEDICINE" ? (
            <div className="grid grid-cols-2 gap-3">
              <Controller
                control={form.control}
                name="medicineType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <LabeledSelectTrigger label={t("medicineType")} />
                    <SelectContent>
                      {MEDICINE_TYPES.map((v) => (
                        <SelectItem key={v} value={v}>
                          {tMedicine(`typeOptions.${v}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <Controller
                control={form.control}
                name="medicineCategory"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <LabeledSelectTrigger label={t("medicineCategory")} />
                    <SelectContent>
                      {MEDICINE_CATEGORIES.map((v) => (
                        <SelectItem key={v} value={v}>
                          {tMedicine(`categoryOptions.${v}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          ) : null}

          {kind === "FEED" ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-foreground">{t("ingredient")}</p>
              {ingredientId ? (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-muted px-3 py-2 text-sm">
                  <span className="truncate text-foreground">{ingredientName ?? ingredientId}</span>
                  <button
                    type="button"
                    aria-label={t("clearIngredient")}
                    onClick={() => {
                      form.setValue("ingredientId", undefined);
                      form.setValue("feedClass", undefined);
                    }}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
              ) : (
                <IngredientPicker
                  placeholder={t("ingredientPlaceholder")}
                  onSelect={(option) => {
                    const picked = ingredients?.find((ing) => ing.id === option.id);
                    // `ingredientId` last: its check needs `feedClass` already set, or the error sticks.
                    if (picked) form.setValue("feedClass", picked.feed_class);
                    if (!form.getValues("name")) form.setValue("name", option.nameEn, { shouldValidate: true });
                    form.setValue("ingredientId", option.id, { shouldValidate: true });
                  }}
                />
              )}
              {form.formState.errors.ingredientId ? <p className="text-sm text-destructive">{t("ingredientRequired")}</p> : null}
              <p className="text-xs text-muted-foreground">{t("ingredientHint")}</p>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">{t("zeroStockNote")}</p>
        </div>
        <div className="border-t border-dashed border-border" />
        <div className="flex gap-3 px-1 pt-5">
          <Button type="button" variant="secondary" className="h-12 flex-1" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button type="submit" className="h-12 flex-1">
            {t("add")}
          </Button>
        </div>
      </form>
    </SheetContent>
  );
}
