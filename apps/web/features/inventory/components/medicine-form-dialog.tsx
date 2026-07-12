"use client"; // form state + mutation

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CalendarDays, Droplets, Info, Sparkles, Timer } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LabeledInput, LabeledSelectTrigger } from "@/components/ui/labeled-field";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem } from "@/components/ui/select";
import { useCreateMedicine, useUpdateMedicine } from "../hooks/use-inventory";
import { medicineFormSchema, type MedicineFormInput } from "../schemas";
import type { CreateMedicinePayload, Medicine, UpdateMedicinePayload } from "../types";

const MEDICINE_TYPES = ["LIQUID", "POWDER", "TABLET", "INJECTABLE", "BOLUS", "OINTMENT", "OTHER"] as const;
const MEDICINE_CATEGORIES = [
  "ANTIBIOTIC",
  "ANTIPARASITIC",
  "VACCINE",
  "VITAMIN",
  "MINERAL",
  "HORMONE",
  "ANTI_INFLAMMATORY",
  "ANALGESIC",
  "OTHER",
] as const;

function toCreatePayload(values: MedicineFormInput): CreateMedicinePayload {
  return {
    name: values.name,
    imageUrl: values.imageUrl || undefined,
    type: values.type,
    category: values.category,
    manufacturer: values.manufacturer || undefined,
    batchId: values.batchId || undefined,
    unit: values.unit,
    currentStock: values.currentStock,
    costPerUnit: values.costPerUnit,
    lowStockThreshold: values.lowStockThreshold,
    purchaseDate: values.purchaseDate,
    expiryDate: values.expiryDate,
    milkWithdrawalDays: values.milkWithdrawalDays,
    meatWithdrawalDays: values.meatWithdrawalDays,
    notes: values.notes || undefined,
  };
}

/** Same fields as `toCreatePayload` minus `currentStock` — edits never touch stock directly
 * (INV-02, `adjust-stock` is the only audited path), so it's built as its own explicit object
 * rather than destructure-omitting from the create payload. */
function toUpdatePayload(values: MedicineFormInput): UpdateMedicinePayload {
  return {
    name: values.name,
    imageUrl: values.imageUrl || undefined,
    type: values.type,
    category: values.category,
    manufacturer: values.manufacturer || undefined,
    batchId: values.batchId || undefined,
    unit: values.unit,
    costPerUnit: values.costPerUnit,
    lowStockThreshold: values.lowStockThreshold,
    purchaseDate: values.purchaseDate,
    expiryDate: values.expiryDate,
    milkWithdrawalDays: values.milkWithdrawalDays,
    meatWithdrawalDays: values.meatWithdrawalDays,
    notes: values.notes || undefined,
  };
}

function toFormDefaults(medicine: Medicine | undefined): Partial<MedicineFormInput> {
  if (!medicine) return { type: "LIQUID", category: "ANTIBIOTIC", currentStock: 0, costPerUnit: 0 };
  return {
    name: medicine.name,
    imageUrl: medicine.imageUrl ?? "",
    type: medicine.type,
    category: medicine.category,
    manufacturer: medicine.manufacturer ?? "",
    batchId: medicine.batchId ?? "",
    unit: medicine.unit,
    currentStock: medicine.currentStock,
    costPerUnit: medicine.costPerUnit,
    lowStockThreshold: medicine.lowStockThreshold,
    purchaseDate: medicine.purchaseDate.slice(0, 10),
    expiryDate: medicine.expiryDate.slice(0, 10),
    milkWithdrawalDays: medicine.milkWithdrawalDays,
    meatWithdrawalDays: medicine.meatWithdrawalDays,
    notes: medicine.notes ?? "",
  };
}

function SectionHeader({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-4 py-2.5 text-sm font-semibold text-foreground">
      <Icon className="size-4 text-primary" aria-hidden />
      {children}
    </div>
  );
}

/**
 * Add/Edit Medicine drawer — Figma "Item Type" frame (732:11067): flush right-edge panel (this
 * frame's own chrome, deliberately kept distinct from the floating/inset "Cattle Details" sheet —
 * Figma itself isn't consistent here, matched per-frame rather than forced into one pattern).
 * **Real gaps vs the mock, flagged not faked**: (1) the mock's square "+ Add Medicine Image"
 * dropzone implies a photo upload, but `medicine.controller.ts` has no
 * `POST /inventory/medicines/:id/photo` endpoint (unlike cattle) — swapped for a plain optional
 * `imageUrl` text field instead of building a dropzone with nowhere to send the file. (2) "Unit"
 * and "Low Stock Alert" are mock dropdowns with invented option lists; the real DTO fields
 * (`unit: string`, `lowStockThreshold: number`) are free text/number, rendered as such. (3)
 * "Milk/Meat Withdrawal Days" are mock dropdowns ("select days"/"select date"); the real fields are
 * plain integers (days), rendered as number inputs.
 */
export function MedicineFormDialog({
  open,
  onOpenChange,
  medicine,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medicine?: Medicine;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open ? <MedicineFormDialogBody key={medicine?.id ?? "create"} onOpenChange={onOpenChange} medicine={medicine} /> : null}
    </Sheet>
  );
}

function MedicineFormDialogBody({
  onOpenChange,
  medicine,
}: {
  onOpenChange: (open: boolean) => void;
  medicine?: Medicine;
}) {
  const t = useTranslations("inventory.medicine.form");
  // `typeOptions`/`categoryOptions` live under `inventory.medicine` (shared with the table/grid
  // columns), not `inventory.medicine.form` — a separate scope for just those two lookups.
  const tOptions = useTranslations("inventory.medicine");
  const isEdit = Boolean(medicine);
  const createMedicine = useCreateMedicine();
  const updateMedicine = useUpdateMedicine();
  const pending = createMedicine.isPending || updateMedicine.isPending;

  const form = useForm<MedicineFormInput>({
    resolver: zodResolver(medicineFormSchema),
    defaultValues: toFormDefaults(medicine),
  });

  async function onSubmit(values: MedicineFormInput) {
    try {
      if (isEdit && medicine) {
        await updateMedicine.mutateAsync({ id: medicine.id, dto: toUpdatePayload(values) });
      } else {
        await createMedicine.mutateAsync(toCreatePayload(values));
      }
      toast.success(isEdit ? t("updatedToast") : t("createdToast"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[650px]">
      <div className="flex items-center justify-between px-6 py-5">
        <SheetTitle className="text-xl font-bold text-foreground">{isEdit ? t("editTitle") : t("createTitle")}</SheetTitle>
      </div>
      <div className="border-t border-border" />

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
          <SectionHeader icon={Sparkles}>{t("basicInfo")}</SectionHeader>
          <div className="grid grid-cols-2 gap-3">
            <LabeledInput id="name" label={t("medicineName")} className="col-span-2" {...form.register("name")} error={form.formState.errors.name?.message} />
            <LabeledInput
              id="currentStock"
              type="number"
              min={0}
              step="0.01"
              label={t("currentStock")}
              disabled={isEdit}
              {...form.register("currentStock", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
            />
            <LabeledInput id="unit" label={t("unit")} placeholder={t("unitPlaceholder")} {...form.register("unit")} error={form.formState.errors.unit?.message} />
            <LabeledInput
              id="costPerUnit"
              type="number"
              min={0}
              step="0.01"
              label={t("costPerUnit")}
              className="col-span-2"
              {...form.register("costPerUnit", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
            />
            <LabeledInput id="imageUrl" label={t("imageUrl")} placeholder={t("imageUrlPlaceholder")} className="col-span-2" {...form.register("imageUrl")} />
          </div>

          <SectionHeader icon={Droplets}>{t("medicineDetails")}</SectionHeader>
          <div className="grid grid-cols-2 gap-3">
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <LabeledSelectTrigger label={t("medicineType")} />
                  <SelectContent>
                    {MEDICINE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {tOptions(`typeOptions.${type}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <Controller
              control={form.control}
              name="category"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <LabeledSelectTrigger label={t("category")} />
                  <SelectContent>
                    {MEDICINE_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {tOptions(`categoryOptions.${category}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <LabeledInput id="manufacturer" label={t("manufacturer")} className="col-span-2" {...form.register("manufacturer")} />
          </div>

          <SectionHeader icon={CalendarDays}>{t("stockExpiry")}</SectionHeader>
          <div className="grid grid-cols-2 gap-3">
            <LabeledInput
              id="purchaseDate"
              type="date"
              label={t("purchaseDate")}
              {...form.register("purchaseDate")}
              error={form.formState.errors.purchaseDate?.message}
            />
            <LabeledInput
              id="expiryDate"
              type="date"
              label={t("expiryDate")}
              {...form.register("expiryDate")}
              error={form.formState.errors.expiryDate?.message}
            />
            <LabeledInput id="batchId" label={t("batchNumber")} {...form.register("batchId")} />
            <LabeledInput
              id="lowStockThreshold"
              type="number"
              min={0}
              label={t("lowStockAlert")}
              {...form.register("lowStockThreshold", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
            />
          </div>

          <SectionHeader icon={Timer}>{t("withdrawalPeriod")}</SectionHeader>
          <div className="grid grid-cols-2 gap-3">
            <LabeledInput
              id="milkWithdrawalDays"
              type="number"
              min={0}
              label={t("milkWithdrawalDays")}
              {...form.register("milkWithdrawalDays", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
            />
            <LabeledInput
              id="meatWithdrawalDays"
              type="number"
              min={0}
              label={t("meatWithdrawalDays")}
              {...form.register("meatWithdrawalDays", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
            />
          </div>

          <SectionHeader icon={Info}>{t("note")}</SectionHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">{t("additionalNotes")}</Label>
            <Textarea id="notes" {...form.register("notes")} />
          </div>
        </div>

        <div className="border-t border-border" />
        <div className="flex gap-3 px-6 py-5">
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
