"use client"; // form state + mutation

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRightToLine, Wrench } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LabeledInput, LabeledSelectTrigger } from "@/components/ui/labeled-field";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem } from "@/components/ui/select";
import { useCreateEquipment, useUpdateEquipment } from "../hooks/use-inventory";
import { equipmentFormSchema, type EquipmentFormInput } from "../schemas";
import type { CreateEquipmentPayload, Equipment, UpdateEquipmentPayload } from "../types";

const EQUIPMENT_TYPES = ["EQUIPMENT", "MACHINERY", "TOOL", "SUPPLY", "OTHER"] as const;

function toCreatePayload(values: EquipmentFormInput): CreateEquipmentPayload {
  return {
    name: values.name,
    assetId: values.assetId || undefined,
    type: values.type,
    unit: values.unit || undefined,
    currentStock: values.currentStock,
    costPerUnit: values.costPerUnit,
    lowStockThreshold: values.lowStockThreshold,
    purchaseDate: values.purchaseDate,
    notes: values.notes || undefined,
  };
}

function toUpdatePayload(values: EquipmentFormInput): UpdateEquipmentPayload {
  return toCreatePayload(values);
}

function toFormDefaults(equipment: Equipment | undefined): Partial<EquipmentFormInput> {
  if (!equipment) return { type: "EQUIPMENT", currentStock: 0, costPerUnit: 0 };
  return {
    name: equipment.name,
    assetId: equipment.assetId ?? "",
    type: equipment.type,
    unit: equipment.unit ?? "",
    currentStock: equipment.currentStock,
    costPerUnit: equipment.costPerUnit,
    lowStockThreshold: equipment.lowStockThreshold,
    purchaseDate: equipment.purchaseDate.slice(0, 10),
    notes: equipment.notes ?? "",
  };
}

/** Plain bold-text grey band — same anatomy as `MedicineFormDialog`/`FeedItemFormDialog`'s
 * `SectionHeader`. */
function SectionHeader({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl bg-muted px-4 py-2.5 text-sm font-semibold text-foreground">{children}</div>;
}

/** Static image slot — same pattern as FeedItem's `PhotoPlaceholder` (`equipment.prisma` has no
 * `imageUrl` column at all, so there's nothing to upload — matches the mock's visual slot without
 * inventing an upload flow the backend can't support). */
function PhotoPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex size-[140px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-input bg-muted text-center">
      <Wrench className="size-[18px] text-muted-foreground" aria-hidden />
      <span className="px-3 text-sm leading-tight text-muted-foreground">{label}</span>
    </div>
  );
}

/**
 * Add/Edit Equipment drawer — Figma "Add New Equipment - Side Modal" (734:26462, `get_design_context`):
 * same floating-card chrome as `MedicineFormDialog`/`FeedItemFormDialog` (10px inset, 20px radius, 2px
 * border, `arrow-right-03` header icon), dashed section dividers, plain-text section header bands.
 * **Real gaps vs the mock, flagged not faked**: the mock's "Item Type" selector (switching between
 * Medicine/Feed/Semen/Milk/Others) isn't built — only this tab's own form exists. The mock's
 * "Location" (Warehouse/Shelf) and "Warranty Expiry" fields have **no backing column anywhere on
 * `Equipment`** (`equipment.prisma`) — dropped entirely rather than rendered as dead inputs. "Unit"
 * is a mock dropdown ("Piece") with an invented option list; the real `unit?: string` field is free
 * text, rendered as such. The mock's "Category" dropdown maps to the real `type: EquipmentType`
 * enum (Equipment/Machinery/Tool/Supply/Other). No photo upload (see `PhotoPlaceholder`).
 */
export function EquipmentFormDialog({
  open,
  onOpenChange,
  equipment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment?: Equipment;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open ? <EquipmentFormDialogBody key={equipment?.id ?? "create"} onOpenChange={onOpenChange} equipment={equipment} /> : null}
    </Sheet>
  );
}

function EquipmentFormDialogBody({
  onOpenChange,
  equipment,
}: {
  onOpenChange: (open: boolean) => void;
  equipment?: Equipment;
}) {
  const t = useTranslations("inventory.equipment.form");
  const tOptions = useTranslations("inventory.equipment");
  const isEdit = Boolean(equipment);
  const createEquipment = useCreateEquipment();
  const updateEquipment = useUpdateEquipment();
  const pending = createEquipment.isPending || updateEquipment.isPending;

  const form = useForm<EquipmentFormInput>({
    resolver: zodResolver(equipmentFormSchema),
    defaultValues: toFormDefaults(equipment),
  });

  async function onSubmit(values: EquipmentFormInput) {
    try {
      if (isEdit && equipment) {
        await updateEquipment.mutateAsync({ id: equipment.id, dto: toUpdatePayload(values) });
      } else {
        await createEquipment.mutateAsync(toCreatePayload(values));
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
              <LabeledInput id="name" label={t("itemName")} className="col-span-2" {...form.register("name")} error={form.formState.errors.name?.message} />
              <LabeledInput
                id="currentStock"
                type="number"
                min={0}
                step="0.01"
                label={t("currentStock")}
                {...form.register("currentStock", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
              />
              <LabeledInput id="unit" label={t("unit")} placeholder={t("unitPlaceholder")} {...form.register("unit")} />
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

          <SectionHeader>{t("details")}</SectionHeader>
          <div className="grid grid-cols-2 gap-3">
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <LabeledSelectTrigger label={t("category")} />
                  <SelectContent>
                    {EQUIPMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {tOptions(`typeOptions.${type}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <LabeledInput id="assetId" label={t("assetId")} {...form.register("assetId")} />
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
