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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { MoneyInput } from "@/components/shared/money-input";
import { PAYMENT_METHODS } from "@/lib/types/payment";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          {receivable ? (
            <DialogDescription>
              {t("description", { outstanding: receivable.outstanding })}
            </DialogDescription>
          ) : null}
        </DialogHeader>
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
                id="receive-amount"
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
            <Label htmlFor="receive-reference">{t("referenceNumber")}</Label>
            <Input id="receive-reference" {...form.register("referenceNumber")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="receive-notes">{t("notes")}</Label>
            <Input id="receive-notes" {...form.register("notes")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={settlePayment.isPending}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={settlePayment.isPending}>
              {settlePayment.isPending ? t("saving") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
