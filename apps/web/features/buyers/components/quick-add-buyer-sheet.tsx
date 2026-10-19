"use client"; // form state + mutation

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRightToLine } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LabeledInput } from "@/components/ui/labeled-field";
import { MoneyInput } from "@/components/shared/money-input";
import { useCreateBuyer } from "../hooks/use-buyers";
import { quickAddBuyerSchema, type QuickAddBuyerInput } from "../schemas";
import type { Buyer } from "../types";

/** Same `setValueAs` adapter the other plain-`register()` number fields use: empty string becomes
 * `undefined` (not `NaN`), so the optional-number zod check passes on an untouched field. */
const numberField = { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) };

/**
 * Quick "add buyer" from inside a sale flow — name, phone, price per litre, payment terms, nothing
 * else. The full 13-field `BuyerFormDialog` stays on the Buyers page; a farmer standing at the gate
 * with a new customer only needs enough to price this sale (the old picker opened the full form with
 * price 0, which silently produced a ৳0 sale). Everything else can be edited later from Buyers.
 *
 * Non-modal, same as `BuyerFormDialog`: it opens on top of the sale sheet, and a second modal layer
 * would fight it for the scroll lock.
 */
export function QuickAddBuyerSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (buyer: Buyer) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      {open ? <QuickAddBuyerBody onOpenChange={onOpenChange} onCreated={onCreated} /> : null}
    </Sheet>
  );
}

function QuickAddBuyerBody({
  onOpenChange,
  onCreated,
}: {
  onOpenChange: (open: boolean) => void;
  onCreated: (buyer: Buyer) => void;
}) {
  const t = useTranslations("buyers.quickAdd");
  const createBuyer = useCreateBuyer();

  const form = useForm<QuickAddBuyerInput>({
    resolver: zodResolver(quickAddBuyerSchema),
    defaultValues: { name: "", phone: "", paymentTermsDays: 0 },
  });

  async function onSubmit(values: QuickAddBuyerInput) {
    try {
      const created = await createBuyer.mutateAsync({
        name: values.name,
        phone: values.phone || undefined,
        buyerType: "LOCAL_TRADER",
        basePricePerLitre: values.basePricePerLitre,
        paymentTermsDays: values.paymentTermsDays ?? 0,
      });
      toast.success(t("createdToast"));
      onCreated(created);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-1 flex-col overflow-y-auto" noValidate>
        <div className="flex flex-1 flex-col gap-4 px-1 py-4">
          <LabeledInput
            id="quickBuyerName"
            label={t("name")}
            error={form.formState.errors.name ? t("nameRequired") : undefined}
            {...form.register("name")}
          />
          <LabeledInput id="quickBuyerPhone" type="tel" label={t("phone")} {...form.register("phone")} />
          <Controller
            control={form.control}
            name="basePricePerLitre"
            render={({ field, fieldState }) => (
              <MoneyInput
                id="quickBuyerPrice"
                label={t("price")}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error ? t("priceRequired") : undefined}
              />
            )}
          />
          <LabeledInput
            id="quickBuyerTerms"
            type="number"
            min={0}
            step={1}
            label={t("terms")}
            {...form.register("paymentTermsDays", numberField)}
          />
          <p className="text-xs text-muted-foreground">{t("moreLater")}</p>
        </div>
        <div className="border-t border-dashed border-border" />
        <div className="flex gap-3 px-1 pt-5">
          <Button type="button" variant="secondary" className="h-12 flex-1" onClick={() => onOpenChange(false)} disabled={createBuyer.isPending}>
            {t("cancel")}
          </Button>
          <Button type="submit" className="h-12 flex-1" disabled={createBuyer.isPending}>
            {createBuyer.isPending ? t("saving") : t("save")}
          </Button>
        </div>
      </form>
    </SheetContent>
  );
}
