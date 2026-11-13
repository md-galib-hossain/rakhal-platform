"use client"; // form state + mutation

import { todayLocalIso } from "@/lib/local-date";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LabeledInput } from "@/components/ui/labeled-field";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@rakhal/ui/ui/textarea";
import { Label } from "@rakhal/ui/ui/label";
import { Button } from "@rakhal/ui/ui/button";
import { Checkbox } from "@rakhal/ui/ui/checkbox";
import { useCreateFeedItemBatch } from "../hooks/use-inventory";
import { feedItemBatchFormSchema, nutritionFormSchema, type FeedItemBatchFormInput, type NutritionFormInput } from "../schemas";
import { profileToDraft, toNutritionInput, type NutritionDraft } from "../nutrition";
import type { CreateFeedItemBatchPayload, FeedItem } from "../types";
import { NutritionFields } from "./nutrition-fields";

const todayIso = () => todayLocalIso();

/**
 * Restock = add a batch (ADR-026, RFE-121). A feed item is a product; every purchase is its own lot with
 * its own cost, date, code and nutrition profile, consumed oldest-first — so a delivery is never blended
 * into an older one. Nutrition inherits the item's default profile; the "this batch is different" toggle
 * reveals it prefilled so a better or worse delivery can be recorded without retyping everything.
 * `POST /inventory/feed-items/:id/batches` (backend RAKHAL-444).
 */
export function FeedItemBatchDialog({
  feedItem,
  open,
  onOpenChange,
}: {
  feedItem: FeedItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open && feedItem ? <FeedItemBatchDialogBody key={feedItem.id} feedItem={feedItem} onOpenChange={onOpenChange} /> : null}
    </Sheet>
  );
}

function FeedItemBatchDialogBody({ feedItem, onOpenChange }: { feedItem: FeedItem; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("inventory.feed.batch");
  const createBatch = useCreateFeedItemBatch();
  const defaultProfile = feedItem.nutrition;
  const [differs, setDiffers] = useState(false);
  const [nutrition, setNutrition] = useState<NutritionDraft>(() => (defaultProfile ? profileToDraft(defaultProfile) : {}));
  const [nutritionErrors, setNutritionErrors] = useState<Partial<Record<keyof NutritionFormInput, string>>>({});

  const form = useForm<FeedItemBatchFormInput>({
    resolver: zodResolver(feedItemBatchFormSchema),
    defaultValues: { costPerUnit: feedItem.costPerUnit, purchaseDate: todayIso() },
  });

  async function onSubmit(values: FeedItemBatchFormInput) {
    let nutritionInput: CreateFeedItemBatchPayload["nutrition"];
    if (differs || !defaultProfile) {
      // No default profile to inherit (should not happen for a real item) → nutrition is mandatory.
      const parsed = nutritionFormSchema.safeParse(nutrition);
      if (!parsed.success) {
        const required = t("nutritionRequired");
        const bad = new Set(parsed.error.issues.map((issue) => String(issue.path[0])));
        setNutritionErrors({
          dmPct: bad.has("dmPct") ? required : undefined,
          cpPct: bad.has("cpPct") ? required : undefined,
          meMjPerKgDm: bad.has("meMjPerKgDm") ? required : undefined,
        });
        return;
      }
      setNutritionErrors({});
      nutritionInput = toNutritionInput(parsed.data);
    }
    try {
      await createBatch.mutateAsync({
        id: feedItem.id,
        dto: {
          currentStock: values.currentStock,
          costPerUnit: values.costPerUnit,
          purchaseDate: values.purchaseDate,
          batchCode: values.batchCode || undefined,
          notes: values.notes || undefined,
          nutrition: nutritionInput,
        },
      });
      toast.success(t("createdToast"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <SheetContent
      side="right"
      className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:max-w-[560px] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5"
    >
      <SheetHeader>
        <SheetTitle>{t("title")}</SheetTitle>
        <SheetDescription>{t("description", { name: feedItem.name })}</SheetDescription>
      </SheetHeader>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-4">
          <div className="grid grid-cols-2 gap-3">
            <LabeledInput
              id="batch-quantity"
              type="number"
              min={0}
              step="0.01"
              label={t("quantity", { unit: feedItem.unit.symbol })}
              error={form.formState.errors.currentStock ? t("quantityRequired") : undefined}
              {...form.register("currentStock", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
            />
            <LabeledInput
              id="batch-cost"
              type="number"
              min={0}
              step="0.01"
              label={t("costPerUnit", { unit: feedItem.unit.symbol })}
              error={form.formState.errors.costPerUnit ? t("costRequired") : undefined}
              {...form.register("costPerUnit", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
            />
            <Controller
              control={form.control}
              name="purchaseDate"
              render={({ field, fieldState }) => (
                <DatePicker
                  id="batch-date"
                  label={t("purchaseDate")}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                  disabledDates={{ after: new Date() }}
                />
              )}
            />
            <LabeledInput id="batch-code" label={t("batchCode")} placeholder={t("batchCodePlaceholder")} {...form.register("batchCode")} />
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
            <div className="flex items-start gap-3">
              <Checkbox id="batch-differs" checked={differs} onCheckedChange={(checked) => setDiffers(checked === true)} className="mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="batch-differs" className="cursor-pointer text-sm font-medium text-foreground">
                  {t("differsLabel")}
                </Label>
                <span className="text-xs text-muted-foreground">{t("differsHint")}</span>
              </div>
            </div>
            {differs ? (
              <NutritionFields value={nutrition} onChange={setNutrition} errors={nutritionErrors} idPrefix="batch-nutrition" />
            ) : defaultProfile ? (
              <p className="text-xs text-muted-foreground">
                {t("inherits", { dm: defaultProfile.dmPct, cp: defaultProfile.cpPct, me: defaultProfile.meMjPerKgDm })}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="batch-notes">{t("notes")}</Label>
            <Textarea id="batch-notes" {...form.register("notes")} />
          </div>
        </div>

        <div className="border-t border-dashed border-border" />
        <div className="flex gap-3 pt-5">
          <Button type="button" variant="secondary" className="h-12 flex-1" onClick={() => onOpenChange(false)} disabled={createBatch.isPending}>
            {t("cancel")}
          </Button>
          <Button type="submit" className="h-12 flex-1" disabled={createBatch.isPending}>
            {createBatch.isPending ? "…" : t("save")}
          </Button>
        </div>
      </form>
    </SheetContent>
  );
}
