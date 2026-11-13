"use client"; // form state + mutation

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@rakhal/ui/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@rakhal/ui/ui/input";
import { Label } from "@rakhal/ui/ui/label";
import { Textarea } from "@rakhal/ui/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rakhal/ui/ui/select";
import { useCreateAsset } from "../hooks/use-finance";
import { createAssetSchema, type CreateAssetInput } from "../schemas";
import { DatePicker } from "@/components/ui/date-picker";

const CATEGORIES = ["EQUIPMENT", "VEHICLE", "BUILDING", "OTHER"] as const;

/**
 * Add Fixed Asset (Asset Distribution tab header action). No Figma frame for this modal — built
 * PRD-spec against the real `CreateFixedAssetDto`. Closes the real gap: the depreciation table had
 * no way to add an asset from the UI, so it only ever showed data seeded server-side.
 */
export function CreateAssetDialog({ trigger }: { trigger: React.ReactNode }) {
  const t = useTranslations("finance.assets.createDialog");
  const createAsset = useCreateAsset();
  const [open, setOpen] = useState(false);

  const form = useForm<CreateAssetInput>({
    resolver: zodResolver(createAssetSchema),
    defaultValues: { category: "EQUIPMENT" },
  });

  async function onSubmit(values: CreateAssetInput) {
    try {
      await createAsset.mutateAsync(values);
      toast.success(t("successToast"));
      form.reset({ category: "EQUIPMENT" });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right" className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="name">{t("name")}</Label>
            <Input id="name" error={form.formState.errors.name?.message} {...form.register("name")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("category")}</Label>
            <Controller
              control={form.control}
              name="category"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {t(`categoryOptions.${category}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="purchaseDate">{t("purchaseDate")}</Label>
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
                />
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="purchasePrice">{t("purchasePrice")}</Label>
              <Input
                id="purchasePrice"
                type="number"
                step="0.01"
                min={0}
                error={form.formState.errors.purchasePrice?.message}
                {...form.register("purchasePrice", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="usefulLifeYears">{t("usefulLifeYears")}</Label>
              <Input
                id="usefulLifeYears"
                type="number"
                min={1}
                {...form.register("usefulLifeYears", { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="salvageValue">{t("salvageValue")}</Label>
            <Input
              id="salvageValue"
              type="number"
              step="0.01"
              min={0}
              {...form.register("salvageValue", { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">{t("description")}</Label>
            <Textarea id="description" rows={2} {...form.register("description")} />
          </div>
          <SheetFooter className="border-t border-dashed border-border pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={createAsset.isPending}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={createAsset.isPending}>
              {createAsset.isPending ? t("saving") : t("submit")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
