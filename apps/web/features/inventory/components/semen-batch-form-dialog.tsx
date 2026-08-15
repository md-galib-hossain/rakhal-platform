"use client"; // form state + mutation

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
import { Label } from "@/components/ui/label";
import { CattlePicker } from "@/components/shared/cattle-picker";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useCreateSemenBatch, useSemenTanks, useUpdateSemenBatch } from "../hooks/use-inventory";
import { semenBatchFormSchema, type SemenBatchFormInput } from "../schemas";
import type { CreateSemenBatchPayload, SemenBatch } from "../types";

const numberField = { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) };

/** Suggested straw-color values with a swatch preview — `strawColor` is a plain string column on
 * the wire (see `types.ts` doc comment), not a backend enum, so these are convenience presets rather
 * than an enforced list; the field still accepts any trimmed string. Shared with `SemenBatchCard`
 * so a batch's colored swatch renders from the same palette a user picked it from. */
export const STRAW_COLOR_SWATCHES = [
  { value: "Red", className: "bg-destructive" },
  { value: "Blue", className: "bg-info" },
  { value: "Green", className: "bg-primary" },
  { value: "Yellow", className: "bg-[var(--color-yellow-500,#ffbf00)]" },
  { value: "White", className: "bg-white border border-border" },
] as const;

function toPayload(values: SemenBatchFormInput): CreateSemenBatchPayload {
  return {
    name: values.name,
    bullId: values.bullId || undefined,
    breed: values.breed || undefined,
    batchCode: values.batchCode || undefined,
    strawColor: values.strawColor || undefined,
    initialVitalityPct: values.initialVitalityPct,
    strawQuantity: values.strawQuantity,
    semenType: values.semenType,
    targetSex: values.semenType === "SEX_SORTED" ? values.targetSex : undefined,
    fatherId: values.fatherId || undefined,
    motherId: values.motherId || undefined,
    tankId: values.tankId || undefined,
    canister: values.canister || undefined,
    goblet: values.goblet || undefined,
    notes: values.notes || undefined,
  };
}

function toFormDefaults(batch: SemenBatch | undefined): Partial<SemenBatchFormInput> {
  if (!batch) return { strawQuantity: 0, initialVitalityPct: undefined };
  return {
    name: batch.name,
    bullId: batch.bullId ?? "",
    breed: batch.breed ?? "",
    batchCode: batch.batchCode ?? "",
    strawColor: batch.strawColor ?? "",
    initialVitalityPct: batch.initialVitalityPct ?? undefined,
    strawQuantity: batch.strawQuantity,
    semenType: batch.semenType ?? undefined,
    targetSex: batch.targetSex ?? undefined,
    fatherId: batch.fatherId ?? "",
    motherId: batch.motherId ?? "",
    tankId: batch.tankId ?? "",
    canister: batch.canister ?? "",
    goblet: batch.goblet ?? "",
    notes: batch.notes ?? "",
  };
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl bg-muted px-4 py-2.5 text-sm font-semibold text-foreground">{children}</div>;
}

/**
 * Add/Edit Straw Batch drawer — Figma "Add Straw" (732:23249, `get_design_context`): "Batch Info" /
 * "Straw Inventory" / "Storage Location Info" / "Note" sections. **Real gap vs the mock, flagged not
 * faked**: the mock has no batch-name input at all, but `CreateSemenBatchDto.name` is required — a
 * "Batch/Straw Name" field was added at the top of "Batch Info" so the form can actually submit (same
 * precedent as Cattle's mock-gap "Additional Info" band). "Breed" renders as free text (a plain
 * string column, not the `breedId` FK Cattle's own breed field uses); "Straw Color" is a `<Select>`
 * of suggested swatches (`STRAW_COLOR_SWATCHES`) over that same free string, not an enforced enum.
 */
export function SemenBatchFormDialog({
  open,
  onOpenChange,
  batch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch?: SemenBatch;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open ? <SemenBatchFormDialogBody key={batch?.id ?? "create"} onOpenChange={onOpenChange} batch={batch} /> : null}
    </Sheet>
  );
}

function SemenBatchFormDialogBody({ onOpenChange, batch }: { onOpenChange: (open: boolean) => void; batch?: SemenBatch }) {
  const t = useTranslations("inventory.semen.batchForm");
  const isEdit = Boolean(batch);
  const tanksQuery = useSemenTanks();
  const createBatch = useCreateSemenBatch();
  const updateBatch = useUpdateSemenBatch();
  const pending = createBatch.isPending || updateBatch.isPending;

  const form = useForm<SemenBatchFormInput>({
    resolver: zodResolver(semenBatchFormSchema),
    defaultValues: toFormDefaults(batch),
  });
  const semenType = form.watch("semenType");

  async function onSubmit(values: SemenBatchFormInput) {
    try {
      if (isEdit && batch) {
        await updateBatch.mutateAsync({ id: batch.id, dto: toPayload(values) });
      } else {
        await createBatch.mutateAsync(toPayload(values));
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
      <div className="flex items-start justify-between pb-5">
        <div className="flex flex-col gap-2">
          <SheetTitle className="text-xl font-bold text-foreground">{isEdit ? t("editTitle") : t("createTitle")}</SheetTitle>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
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

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4">
          <SectionHeader>{t("batchInfo")}</SectionHeader>
          <div className="flex flex-col gap-3">
            <LabeledInput id="name" label={t("batchName")} placeholder={t("batchNamePlaceholder")} {...form.register("name")} error={form.formState.errors.name?.message} />
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">{t("bullId")}</Label>
                <Controller
                  control={form.control}
                  name="bullId"
                  render={({ field }) => (
                    <CattlePicker value={field.value} onValueChange={(id) => field.onChange(id)} filters={{ gender: "MALE" }} placeholder={t("bullIdPlaceholder")} />
                  )}
                />
              </div>
              <LabeledInput id="breed" label={t("breed")} placeholder={t("breedPlaceholder")} {...form.register("breed")} />
              <LabeledInput id="batchCode" label={t("batchCode")} placeholder={t("batchCodePlaceholder")} {...form.register("batchCode")} />
              <Controller
                control={form.control}
                name="strawColor"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <LabeledSelectTrigger label={t("strawColor")} placeholder={t("selectColor")} />
                    <SelectContent>
                      {STRAW_COLOR_SWATCHES.map((color) => (
                        <SelectItem key={color.value} value={color.value}>
                          <span className="flex items-center gap-2">
                            <span className={cn("size-3 rounded-sm", color.className)} />
                            {color.value}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <LabeledInput
                id="initialVitalityPct"
                type="number"
                min={0}
                max={100}
                label={t("initialVitality")}
                endIcon={<span className="text-xs text-muted-foreground">%</span>}
                {...form.register("initialVitalityPct", numberField)}
                error={form.formState.errors.initialVitalityPct?.message}
              />
              <Controller
                control={form.control}
                name="semenType"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      if (value !== "SEX_SORTED") form.setValue("targetSex", undefined);
                    }}
                  >
                    <LabeledSelectTrigger label={t("semenType")} placeholder={t("selectSemenType")} />
                    <SelectContent>
                      <SelectItem value="CONVENTIONAL">{t("semenTypeValue.CONVENTIONAL")}</SelectItem>
                      <SelectItem value="SEX_SORTED">{t("semenTypeValue.SEX_SORTED")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {semenType === "SEX_SORTED" ? (
                <Controller
                  control={form.control}
                  name="targetSex"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <LabeledSelectTrigger label={t("targetSex")} placeholder={t("selectTargetSex")} />
                      <SelectContent>
                        <SelectItem value="FEMALE">{t("targetSexValue.FEMALE")}</SelectItem>
                        <SelectItem value="MALE">{t("targetSexValue.MALE")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              ) : null}
            </div>
          </div>

          <SectionHeader>{t("strawInventory")}</SectionHeader>
          <div className="flex flex-col gap-3">
            <LabeledInput
              id="strawQuantity"
              type="number"
              min={0}
              label={t("strawQuantity")}
              {...form.register("strawQuantity", numberField)}
              error={form.formState.errors.strawQuantity?.message}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">{t("fatherId")}</Label>
                <Controller
                  control={form.control}
                  name="fatherId"
                  render={({ field }) => (
                    <CattlePicker value={field.value} onValueChange={(id) => field.onChange(id)} filters={{ gender: "MALE" }} placeholder={t("fatherIdPlaceholder")} />
                  )}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">{t("motherId")}</Label>
                <Controller
                  control={form.control}
                  name="motherId"
                  render={({ field }) => (
                    <CattlePicker value={field.value} onValueChange={(id) => field.onChange(id)} filters={{ gender: "FEMALE" }} placeholder={t("motherIdPlaceholder")} />
                  )}
                />
              </div>
            </div>
          </div>

          <SectionHeader>{t("storageLocationInfo")}</SectionHeader>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Controller
                control={form.control}
                name="tankId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <LabeledSelectTrigger label={t("tank")} placeholder={t("selectTank")} />
                    <SelectContent>
                      {(tanksQuery.data ?? []).map((tank) => (
                        <SelectItem key={tank.id} value={tank.id}>
                          {tank.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <LabeledInput id="canister" label={t("canister")} placeholder={t("canisterPlaceholder")} {...form.register("canister")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <LabeledInput id="goblet" label={t("goblet")} placeholder={t("gobletPlaceholder")} {...form.register("goblet")} />
            </div>
          </div>

          <SectionHeader>{t("note")}</SectionHeader>
          <Textarea id="notes" placeholder={t("notesPlaceholder")} className="h-20" {...form.register("notes")} />
        </div>

        <div className="border-t border-dashed border-border" />
        <div className="flex gap-2 pt-5">
          <Button type="button" variant="secondary" className="h-[52px] flex-1 rounded-xl" onClick={() => onOpenChange(false)} disabled={pending}>
            {t("cancel")}
          </Button>
          <Button type="submit" className="h-[52px] flex-1 rounded-xl" disabled={pending}>
            {pending ? "…" : isEdit ? t("save") : t("add")}
          </Button>
        </div>
      </form>
    </SheetContent>
  );
}
