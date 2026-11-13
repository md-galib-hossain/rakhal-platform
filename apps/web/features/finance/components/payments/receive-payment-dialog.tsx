"use client"; // form state + mutation

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { format } from "date-fns";
import { ApiError } from "@/lib/api/errors";
import { useCan } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@rakhal/ui/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { MoneyInput } from "@/components/shared/money-input";
import { PaymentMethodPicker } from "@/components/shared/payment-method-picker";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/types/payment";
import { AccountPicker } from "../account-picker";
import { useSettlePayment } from "../../hooks/use-finance-v2";
import type { Receivable } from "../../types-v2";

const receivePaymentSchema = z.object({
  financialAccountId: z.string().min(1),
  amount: z.number().positive(),
  method: z.enum(PAYMENT_METHODS),
  transactionDate: z.string().min(1),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

type ReceivePaymentInput = z.infer<typeof receivePaymentSchema>;

/**
 * RAKHAL-358 — Receive Payment (settling a `Receivable`). Records a `FinancePayment`
 * (`direction: "INCOMING"`) against the picked `FinancialAccount` and allocates its full amount to
 * `receivable.id` in one mutation (`useSettlePayment("RECEIVABLE")`). Amount defaults to — and is
 * capped at — the receivable's current `outstanding` (a farmer receiving payment for an
 * already-settled document shouldn't be able to over-collect; the backend enforces this too via
 * `ReceivableService.assertWithinOutstanding`, this is just the honest client-side default/hint).
 */
export function ReceivePaymentDialog({
  receivable,
  open,
  onOpenChange,
}: {
  receivable: Receivable | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("finance.settlementsV2.receivePaymentDialog");
  const tMethods = useTranslations("finance.settlementsV2.methodOptions");
  const methodLabels = Object.fromEntries(PAYMENT_METHODS.map((method) => [method, tMethods(method)])) as Record<PaymentMethod, string>;
  const settlePayment = useSettlePayment("RECEIVABLE");
  // RAKHAL-361 RBAC audit: `ReceivablesTable`'s own "Receive Payment" row action already gates the
  // entry point on `<Can I="finance.create">` (this is a money-moving action, same permission
  // `RecordSaleTrigger`/purchasing's dialogs use) — this is defense-in-depth for the submit itself,
  // same pattern `transfer-form-sheet.tsx`'s `canTransfer` guard already uses in this codebase.
  const can = useCan();
  const canRecord = can("finance.create");

  const form = useForm<ReceivePaymentInput>({
    resolver: zodResolver(receivePaymentSchema),
    values: {
      financialAccountId: "",
      amount: receivable ? Number(receivable.outstanding) : 0,
      method: "CASH",
      transactionDate: format(new Date(), "yyyy-MM-dd"),
      referenceNumber: "",
      notes: "",
    },
  });

  async function onSubmit(values: ReceivePaymentInput) {
    if (!receivable || !canRecord) return;
    try {
      await settlePayment.mutateAsync({ documentId: receivable.id, dto: values });
      toast.success(t("successToast"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          {receivable ? (
            <SheetDescription>
              {t("description", { outstanding: receivable.outstanding })}
            </SheetDescription>
          ) : null}
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Controller
            control={form.control}
            name="financialAccountId"
            render={({ field }) => <AccountPicker value={field.value} onChange={field.onChange} />}
          />

          <Controller
            control={form.control}
            name="amount"
            render={({ field, fieldState }) => (
              <MoneyInput
                id="receive-amount"
                label={t("amount")}
                value={field.value}
                onChange={(v) => field.onChange(v ?? 0)}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />

          <Controller
            control={form.control}
            name="method"
            render={({ field }) => (
              <PaymentMethodPicker value={field.value} onChange={field.onChange} labels={methodLabels} groupLabel={t("method")} />
            )}
          />

          <Controller
            control={form.control}
            name="transactionDate"
            render={({ field, fieldState }) => (
              <DatePicker label={t("transactionDate")} value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
            )}
          />

          <div className="space-y-1.5">
            <Label htmlFor="receive-reference">{t("referenceNumber")}</Label>
            <Input id="receive-reference" {...form.register("referenceNumber")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="receive-notes">{t("notes")}</Label>
            <Input id="receive-notes" {...form.register("notes")} />
          </div>

          <SheetFooter className="border-t border-dashed border-border pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={settlePayment.isPending}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={settlePayment.isPending}>
              {settlePayment.isPending ? t("saving") : t("submit")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
