"use client"; // form state + mutation

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
import { useCreateForage, useUpdateForage } from "../hooks/use-inventory";
import { forageFormSchema, type ForageFormInput } from "../schemas";
import type { CreateForagePayload, Forage, UpdateForagePayload } from "../types";

const FORAGE_TYPES = ["ROUGHAGE", "CONCENTRATE", "SILAGE", "SUPPLEMENT", "BY_PRODUCT", "MINERAL", "OTHER"] as const;

function toCreatePayload(values: ForageFormInput): CreateForagePayload {
  return {
    name: values.name,
    type: values.type,
    category: values.category || undefined,
    unit: values.unit,
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

/** No `currentStock`-omission needed here unlike Medicine's `toUpdatePayload` — Forage has no
 * separate audited adjust-stock endpoint, so `PATCH /inventory/forages/:id` accepts it directly
 * (`UpdateForageDto`). Same shape as create, kept as its own function for symmetry with Medicine's
 * two-function pattern rather than reusing `toCreatePayload` for both. */
function toUpdatePayload(values: ForageFormInput): UpdateForagePayload {
  return toCreatePayload(values);
}

function toFormDefaults(forage: Forage | undefined): Partial<ForageFormInput> {
  if (!forage) return { type: "ROUGHAGE", currentStock: 0, costPerUnit: 0 };
  return {
    name: forage.name,
    type: forage.type,
    category: forage.category ?? "",
    unit: forage.unit,
    kgPerUnit: forage.kgPerUnit ?? undefined,
    currentStock: forage.currentStock,
    costPerUnit: forage.costPerUnit,
    lowStockThreshold: forage.lowStockThreshold,
    moisturePct: forage.moisturePct ?? undefined,
    supplier: forage.supplier ?? "",
    purchaseDate: forage.purchaseDate.slice(0, 10),
    notes: forage.notes ?? "",
  };
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl bg-muted px-4 py-2.5 text-sm font-semibold text-foreground">{children}</div>;
}

/** Static stand-in for the Figma "+ Add Forage Image" dropzone (732:13198) — **not** a real upload
 * control. `Forage` has no photo column/endpoint at all (see `types.ts#Forage` doc comment), unlike
 * Medicine which got one added specifically for this modal, so wiring a clickable file picker here
 * would silently do nothing on save. Keeps the same 140px visual slot for layout fidelity without
 * implying a capability that doesn't exist. */
function PhotoPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex size-[140px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-input bg-muted text-center">
      <Wheat className="size-[18px] text-muted-foreground" aria-hidden />
      <span className="px-3 text-sm leading-tight text-muted-foreground">{label}</span>
    </div>
  );
}

/**
 * Add/Edit Forage drawer — Figma "Add Forage - Side Modal" (732:13198, `get_design_context`): same
 * floating-card chrome as `MedicineFormDialog`/`CattleDetailSheet` (10px inset, 20px radius, 2px
 * border, `arrow-right-03` header icon), dashed section dividers, plain-text section header bands.
 * **Real gaps vs the mock, flagged not faked**: the mock's "Item Type" selector (switching between
 * Medicine/Forage/Semen/Milk/Others) isn't built, same as Medicine's form; "Low Stock Alert" is a
 * mock dropdown ("select number") — the real `lowStockThreshold` DTO field is a plain number,
 * rendered as such. No photo upload (see `PhotoPlaceholder`).
 */
export function ForageFormDialog({
  open,
  onOpenChange,
  forage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forage?: Forage;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open ? <ForageFormDialogBody key={forage?.id ?? "create"} onOpenChange={onOpenChange} forage={forage} /> : null}
    </Sheet>
  );
}

function ForageFormDialogBody({
  onOpenChange,
  forage,
}: {
  onOpenChange: (open: boolean) => void;
  forage?: Forage;
}) {
  const t = useTranslations("inventory.forage.form");
  const tOptions = useTranslations("inventory.forage");
  const isEdit = Boolean(forage);
  const createForage = useCreateForage();
  const updateForage = useUpdateForage();
  const pending = createForage.isPending || updateForage.isPending;

  const form = useForm<ForageFormInput>({
    resolver: zodResolver(forageFormSchema),
    defaultValues: toFormDefaults(forage),
  });

  async function onSubmit(values: ForageFormInput) {
    try {
      if (isEdit && forage) {
        await updateForage.mutateAsync({ id: forage.id, dto: toUpdatePayload(values) });
      } else {
        await createForage.mutateAsync(toCreatePayload(values));
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
              <LabeledInput id="unit" label={t("unit")} placeholder={t("unitPlaceholder")} {...form.register("unit")} error={form.formState.errors.unit?.message} />
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
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <LabeledSelectTrigger label={t("feedType")} />
                  <SelectContent>
                    {FORAGE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {tOptions(`typeOptions.${type}`)}
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
