"use client"; // form state + mutation

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRightToLine } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@rakhal/ui/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LabeledInput, LabeledSelectTrigger } from "@/components/ui/labeled-field";
import { Select, SelectContent, SelectItem } from "@/components/ui/select";
import { useCreateBuyer, useUpdateBuyer } from "../hooks/use-buyers";
import { BUYER_TYPES, buyerFormSchema, type BuyerFormInput } from "../schemas";
import type { Buyer } from "../types";

/** Plain bold-text grey band — same anatomy as `EquipmentFormDialog`'s `SectionHeader`. */
function SectionHeader({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl bg-muted px-4 py-2.5 text-sm font-semibold text-foreground">{children}</div>;
}

/**
 * Create/Edit Buyer — right-side drawer, same floating-card chrome (10px inset, 20px radius, 2px
 * border, `arrow-right-03` header icon, dashed section dividers) as `EquipmentFormDialog`/
 * `MedicineFormDialog`. Was previously a centered `Dialog` — moved to match every other form's
 * side-sheet pattern in the app.
 *
 * `onCreated` (optional) fires with the newly created `Buyer` right after a successful *create*
 * (not edit) — `BuyerPicker`'s inline "+ Add new buyer" uses this to auto-select the buyer it just
 * created without a second round trip.
 */
export function BuyerFormDialog({
  buyer,
  open,
  onOpenChange,
  onCreated,
}: {
  buyer: Buyer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (buyer: Buyer) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      {open ? (
        <BuyerFormDialogBody key={buyer?.id ?? "create"} buyer={buyer} onOpenChange={onOpenChange} onCreated={onCreated} />
      ) : null}
    </Sheet>
  );
}

function BuyerFormDialogBody({
  buyer,
  onOpenChange,
  onCreated,
}: {
  buyer: Buyer | null;
  onOpenChange: (open: boolean) => void;
  onCreated?: (buyer: Buyer) => void;
}) {
  const t = useTranslations("buyers.form");
  const createBuyer = useCreateBuyer();
  const updateBuyer = useUpdateBuyer();
  const isEdit = buyer != null;
  const isPending = createBuyer.isPending || updateBuyer.isPending;

  const form = useForm<BuyerFormInput>({
    resolver: zodResolver(buyerFormSchema),
    defaultValues: buyer
      ? {
          name: buyer.name,
          contactPerson: buyer.contactPerson ?? undefined,
          phone: buyer.phone ?? undefined,
          email: buyer.email ?? undefined,
          buyerType: buyer.buyerType,
          paymentTermsDays: buyer.paymentTermsDays,
          basePricePerLitre: buyer.basePricePerLitre,
          baseFatPct: buyer.baseFatPct,
          fatBonusPer01Pct: buyer.fatBonusPer01Pct,
          sccThreshold: buyer.sccThreshold,
          sccPenaltyPer100k: buyer.sccPenaltyPer100k,
          collectionTime: buyer.collectionTime ?? undefined,
          bankDetails: buyer.bankDetails ?? undefined,
        }
      : { name: "", buyerType: "DAIRY_COMPANY", basePricePerLitre: 0 },
  });

  async function onSubmit(values: BuyerFormInput) {
    try {
      if (isEdit && buyer) {
        await updateBuyer.mutateAsync({ id: buyer.id, dto: values });
        toast.success(t("updatedToast"));
      } else {
        const created = await createBuyer.mutateAsync(values);
        toast.success(t("createdToast"));
        onCreated?.(created);
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <SheetContent
      showClose={false}
      className="inset-y-2.5 right-2.5 flex h-[calc(100vh-20px)] w-[calc(100%-20px)] max-w-[560px] flex-col gap-0 rounded-[20px] border-2 border-border p-5 shadow-2xl sm:max-w-[560px]"
    >
      <div className="flex items-center justify-between pb-5">
        <SheetTitle className="text-xl font-bold text-foreground">{isEdit ? t("editTitle") : t("createTitle")}</SheetTitle>
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

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-4">
          <SectionHeader>{t("basicInfo")}</SectionHeader>
          <LabeledInput id="name" label={t("name")} error={form.formState.errors.name?.message} {...form.register("name")} />
          <Controller
            control={form.control}
            name="buyerType"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <LabeledSelectTrigger label={t("buyerType")} />
                <SelectContent>
                  {BUYER_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`typeOptions.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <LabeledInput id="contactPerson" label={t("contactPerson")} {...form.register("contactPerson")} />
            <LabeledInput id="phone" label={t("phone")} {...form.register("phone")} />
          </div>
          <LabeledInput id="email" type="email" label={t("email")} {...form.register("email")} />

          <SectionHeader>{t("pricingTerms")}</SectionHeader>
          <div className="grid grid-cols-2 gap-3">
            <LabeledInput
              id="basePricePerLitre"
              type="number"
              step="0.01"
              min={0}
              label={t("basePricePerLitre")}
              error={form.formState.errors.basePricePerLitre?.message}
              {...form.register("basePricePerLitre", { valueAsNumber: true })}
            />
            <LabeledInput
              id="paymentTermsDays"
              type="number"
              min={0}
              label={t("paymentTermsDays")}
              {...form.register("paymentTermsDays", { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <LabeledInput
              id="baseFatPct"
              type="number"
              step="0.1"
              min={0}
              label={t("baseFatPct")}
              {...form.register("baseFatPct", { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) })}
            />
            <LabeledInput
              id="fatBonusPer01Pct"
              type="number"
              step="0.01"
              min={0}
              label={t("fatBonusPer01Pct")}
              {...form.register("fatBonusPer01Pct", { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <LabeledInput
              id="sccThreshold"
              type="number"
              min={0}
              label={t("sccThreshold")}
              {...form.register("sccThreshold", { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) })}
            />
            <LabeledInput
              id="sccPenaltyPer100k"
              type="number"
              step="0.01"
              min={0}
              label={t("sccPenaltyPer100k")}
              {...form.register("sccPenaltyPer100k", { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) })}
            />
          </div>

          <SectionHeader>{t("note")}</SectionHeader>
          <LabeledInput id="bankDetails" label={t("bankDetails")} {...form.register("bankDetails")} />
        </div>

        <div className="border-t border-dashed border-border" />
        <div className="flex gap-3 pt-5">
          <Button type="button" variant="secondary" className="h-12 flex-1" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t("cancel")}
          </Button>
          <Button type="submit" className="h-12 flex-1" disabled={isPending}>
            {isPending ? t("saving") : isEdit ? t("save") : t("create")}
          </Button>
        </div>
      </form>
    </SheetContent>
  );
}
