"use client"; // form state + mutation + staged photo upload

import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRightToLine, Plus, X } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LabeledInput, LabeledSelectTrigger } from "@/components/ui/labeled-field";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem } from "@/components/ui/select";
import {
  useCreateMedicine,
  useRemoveMedicinePhoto,
  useSetMedicinePhoto,
  useUpdateMedicine,
} from "../hooks/use-inventory";
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

/** Plain bold-text grey band — Figma "Add Medicine"/"Add Forage" side modal section headers
 * (732:11120 / 732:13198) have no icon, unlike the earlier pass's icon+label bar. */
function SectionHeader({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl bg-muted px-4 py-2.5 text-sm font-semibold text-foreground">{children}</div>;
}

/** Square "+ Add Medicine Image" dropzone — same anatomy as cattle's `PhotoDropzone`
 * (`cattle-form-dialog.tsx`): dashed border, muted fill, centered plus icon + 2-line label,
 * local-only until Save. */
function PhotoDropzone({
  previewUrl,
  onPick,
  onClear,
  label,
}: {
  previewUrl: string | null;
  onPick: (file: File) => void;
  onClear: () => void;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="relative size-[140px] shrink-0">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex size-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-input bg-muted text-center transition-colors hover:bg-muted/70"
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- transient local object-URL / signed R2 URL preview
          <img src={previewUrl} alt="" className="size-full rounded-2xl object-cover" />
        ) : (
          <>
            <Plus className="size-[18px] text-muted-foreground" aria-hidden />
            <span className="px-3 text-sm leading-tight text-muted-foreground">{label}</span>
          </>
        )}
      </button>
      {previewUrl ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Remove"
          className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-xs hover:text-destructive"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/**
 * Add/Edit Medicine drawer — Figma "Add Medicine - Side Modal" (732:11120, `get_design_context`):
 * same floating-card chrome as the "Cattle Details" sheet (10px inset from the viewport edges,
 * 20px radius, 2px border, `arrow-right-03` header icon), dashed section dividers, plain-text
 * (no-icon) section header bands, and a real "+ Add Medicine Image" dropzone — backed by a new
 * `POST/DELETE /inventory/medicines/:id/photo` pair added to the backend for this (mirrors
 * `POST/DELETE /cattle/:id/photo` exactly: `MediaService`, private-R2, signed thumb URLs; a new
 * `Medicine.photoAssetId` column + `MediaCategory.MEDICINE`/`MediaUsage.PRODUCT_PHOTO` enum values,
 * migration `medicine_photo_upload`). Photo is staged locally and uploaded right after
 * create/update resolves, same one-click flow as the cattle form. **Real gaps vs the mock, flagged
 * not faked**: "Unit" and "Low Stock Alert" are mock dropdowns with invented option lists; the real
 * DTO fields (`unit: string`, `lowStockThreshold: number`) are free text/number, rendered as such.
 * "Milk/Meat Withdrawal Days" are mock dropdowns ("select days"/"select date"); the real fields are
 * plain integers (days), rendered as number inputs. The mock's "Item Type" selector (switching
 * between Medicine/Forage/Semen/Milk/Others) isn't built — only Medicine has a real form this pass.
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
  const setPhoto = useSetMedicinePhoto();
  const removePhotoMutation = useRemoveMedicinePhoto();

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [clearExistingPhoto, setClearExistingPhoto] = useState(false);

  const pending = createMedicine.isPending || updateMedicine.isPending || setPhoto.isPending || removePhotoMutation.isPending;
  const displayedPhotoUrl = photoPreviewUrl ?? (!clearExistingPhoto ? (medicine?.imageUrl ?? null) : null);

  const form = useForm<MedicineFormInput>({
    resolver: zodResolver(medicineFormSchema),
    defaultValues: toFormDefaults(medicine),
  });

  function handlePhotoPick(file: File) {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
    setClearExistingPhoto(false);
  }

  function handlePhotoClear() {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    setClearExistingPhoto(true);
  }

  async function onSubmit(values: MedicineFormInput) {
    try {
      const savedId = isEdit && medicine
        ? (await updateMedicine.mutateAsync({ id: medicine.id, dto: toUpdatePayload(values) })).id
        : (await createMedicine.mutateAsync(toCreatePayload(values))).id;
      try {
        if (photoFile) {
          await setPhoto.mutateAsync({ id: savedId, file: photoFile });
        } else if (isEdit && clearExistingPhoto && medicine?.imageUrl) {
          await removePhotoMutation.mutateAsync(savedId);
        }
      } catch (photoErr) {
        toast.error(photoErr instanceof ApiError ? photoErr.message : t("photoGenericError"));
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
        {/* `min-h-0 flex-1` is what makes THIS div (not the outer Sheet/form) the scroll
            container — without it the div sizes to its content and pushes the footer down below
            the fold instead of pinning it, since the outer `SheetContent` also carries its own
            `overflow-y-auto` (base `Sheet` primitive) and will happily scroll the whole header+
            form+footer as one unit if this inner div doesn't claim the scrolling itself. */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4">
          <SectionHeader>{t("basicInfo")}</SectionHeader>
          <div className="flex gap-4">
            <PhotoDropzone previewUrl={displayedPhotoUrl} onPick={handlePhotoPick} onClear={handlePhotoClear} label={t("addMedicineImage")} />
            <div className="grid flex-1 grid-cols-2 gap-3">
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
            </div>
          </div>

          <SectionHeader>{t("medicineDetails")}</SectionHeader>
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
            <Controller
              control={form.control}
              name="expiryDate"
              render={({ field, fieldState }) => (
                <DatePicker
                  id="expiryDate"
                  label={t("expiryDate")}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                />
              )}
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

          <SectionHeader>{t("withdrawalPeriod")}</SectionHeader>
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
