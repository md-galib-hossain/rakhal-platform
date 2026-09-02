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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { MoneyInput } from "@/components/shared/money-input";
import { PAYMENT_METHODS } from "@/lib/types/payment";
import { AccountPicker } from "../account-picker";
import { useSettlePayment } from "../../hooks/use-finance-v2";
import type { Payable } from "../../types-v2";

const makePaymentSchema = z.object({
  financialAccountId: z.string().min(1),
  amount: z.number().positive(),
  method: z.enum(PAYMENT_METHODS),
  transactionDate: z.string().min(1),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

type MakePaymentInput = z.infer<typeof makePaymentSchema>;

/**
 * RAKHAL-358 — Make Payment (settling a `Payable`). Mirrors `ReceivePaymentDialog` exactly, on the
 * liability side: `direction: "OUTGOING"` (money leaving the picked account), allocated in full to
 * `payable.id` via the same `useSettlePayment("PAYABLE")` mutation.
 */
export function MakePaymentDialog({
  payable,
  open,
  onOpenChange,
}: {
  payable: Payable | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("finance.settlementsV2.makePaymentDialog");
  const tMethods = useTranslations("finance.settlementsV2.methodOptions");
  const settlePayment = useSettlePayment("PAYABLE");
  // RAKHAL-361 RBAC audit — see `ReceivePaymentDialog`'s matching comment.
  const can = useCan();
  const canRecord = can("finance.create");

  const form = useForm<MakePaymentInput>({
    resolver: zodResolver(makePaymentSchema),
    values: {
      financialAccountId: "",
      amount: payable ? Number(payable.outstanding) : 0,
      method: "CASH",
      transactionDate: format(new Date(), "yyyy-MM-dd"),
      referenceNumber: "",
      notes: "",
    },
  });

  async function onSubmit(values: MakePaymentInput) {
    if (!payable || !canRecord) return;
    try {
      await settlePayment.mutateAsync({ documentId: payable.id, dto: values });
      toast.success(t("successToast"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          {payable ? <SheetDescription>{t("description", { outstanding: payable.outstanding })}</SheetDescription> : null}
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label>{t("account")}</Label>
            <Controller
              control={form.control}
              name="financialAccountId"
              render={({ field, fieldState }) => (
                <AccountPicker value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
              )}
            />
          </div>

          <Controller
            control={form.control}
            name="amount"
            render={({ field, fieldState }) => (
              <MoneyInput
                id="make-payment-amount"
                label={t("amount")}
                value={field.value}
                onChange={(v) => field.onChange(v ?? 0)}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />

          <div className="space-y-1.5">
            <Label>{t("method")}</Label>
            <Controller
              control={form.control}
              name="method"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method} value={method}>
                        {tMethods(method)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <Controller
            control={form.control}
            name="transactionDate"
            render={({ field, fieldState }) => (
              <DatePicker label={t("transactionDate")} value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
            )}
          />

          <div className="space-y-1.5">
            <Label htmlFor="make-payment-reference">{t("referenceNumber")}</Label>
            <Input id="make-payment-reference" {...form.register("referenceNumber")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="make-payment-notes">{t("notes")}</Label>
            <Input id="make-payment-notes" {...form.register("notes")} />
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
