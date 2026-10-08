"use client"; // form state + mutation

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRightToLine } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LabeledInput } from "@/components/ui/labeled-field";
import { Button } from "@/components/ui/button";
import { useCreateSemenTank, useUpdateSemenTank } from "../hooks/use-inventory";
import { semenTankFormSchema, type SemenTankFormInput } from "../schemas";
import type { CreateSemenTankPayload, SemenTank, UpdateSemenTankPayload } from "../types";

const numberField = { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) };

function toPayload(values: SemenTankFormInput): CreateSemenTankPayload {
  return {
    name: values.name,
    modelManufacturer: values.modelManufacturer || undefined,
    strawCapacity: values.strawCapacity,
    numCanisters: values.numCanisters,
    numGoblets: values.numGoblets,
    storageLocation: values.storageLocation || undefined,
  };
}

function toFormDefaults(tank: SemenTank | undefined): Partial<SemenTankFormInput> {
  if (!tank) return {};
  return {
    name: tank.name,
    modelManufacturer: tank.modelManufacturer ?? "",
    strawCapacity: tank.strawCapacity,
    numCanisters: tank.numCanisters ?? undefined,
    numGoblets: tank.numGoblets ?? undefined,
    storageLocation: tank.storageLocation ?? "",
  };
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl bg-muted px-4 py-2.5 text-sm font-semibold text-foreground">{children}</div>;
}

/**
 * Add/Edit Semen Tank drawer — Figma "Add New Tank" (732:21955, `get_design_context`): same
 * floating-card chrome as the Milk/FeedItem form dialogs (10px inset, 20px radius, 2px border,
 * `arrow-right-03` header icon).
 * **Real gap vs the mock, flagged not faked**: the mock's "Staw in Stock" input has no backing field
 * on `CreateSemenTankDto` at all (stock is derived from batches, see `types.ts` doc comment) — omitted
 * from this form entirely rather than rendered as a dead input.
 */
export function SemenTankFormDialog({
  open,
  onOpenChange,
  tank,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tank?: SemenTank;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open ? <SemenTankFormDialogBody key={tank?.id ?? "create"} onOpenChange={onOpenChange} tank={tank} /> : null}
    </Sheet>
  );
}

function SemenTankFormDialogBody({ onOpenChange, tank }: { onOpenChange: (open: boolean) => void; tank?: SemenTank }) {
  const t = useTranslations("inventory.semen.tankForm");
  const isEdit = Boolean(tank);
  const createTank = useCreateSemenTank();
  const updateTank = useUpdateSemenTank();
  const pending = createTank.isPending || updateTank.isPending;

  const form = useForm<SemenTankFormInput>({
    resolver: zodResolver(semenTankFormSchema),
    defaultValues: toFormDefaults(tank),
  });

  async function onSubmit(values: SemenTankFormInput) {
    try {
      if (isEdit && tank) {
        await updateTank.mutateAsync({ id: tank.id, dto: toPayload(values) as UpdateSemenTankPayload });
      } else {
        await createTank.mutateAsync(toPayload(values));
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
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-4">
          <SectionHeader>{t("tankInfo")}</SectionHeader>
          <div className="grid grid-cols-2 gap-3">
            <LabeledInput id="name" label={t("tankName")} placeholder={t("tankNamePlaceholder")} {...form.register("name")} error={form.formState.errors.name?.message} />
            <LabeledInput id="modelManufacturer" label={t("modelManufacturer")} placeholder={t("modelManufacturerPlaceholder")} {...form.register("modelManufacturer")} />
            <LabeledInput
              id="strawCapacity"
              type="number"
              min={1}
              label={t("strawCapacity")}
              {...form.register("strawCapacity", numberField)}
              error={form.formState.errors.strawCapacity?.message}
            />
            <LabeledInput id="numCanisters" type="number" min={0} label={t("numCanisters")} {...form.register("numCanisters", numberField)} />
            <LabeledInput id="numGoblets" type="number" min={0} label={t("numGoblets")} {...form.register("numGoblets", numberField)} />
            <LabeledInput id="storageLocation" label={t("storageLocation")} placeholder={t("storageLocationPlaceholder")} {...form.register("storageLocation")} />
          </div>
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
