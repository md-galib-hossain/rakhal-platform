"use client"; // form state + mutation

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowRightToLine } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { MoneyInput } from "@/components/shared/money-input";
import { MoneyText } from "@/components/shared/money-text";
import { Button } from "@/components/ui/button";
import { useCan } from "@/lib/auth/permissions";
import { AccountPicker } from "../account-picker";
import { useCreateTransfer } from "../../hooks/use-finance-v2";
import { transferSchema, type TransferFormInput } from "../../schemas-v2";
import { computeTransferTotal } from "../../lib/transfer-math";

/**
 * RAKHAL-356 — Transfer between two accounts, with an optional fee, per `FINANCE_V2_DESIGN.md` §3/§6
 * ("Transfer source != destination"). `finance.transfer` is **owner-only** since RAKHAL-353 (a
 * Manager gets a 403 from the real backend route) — gated here with `<Can>` so a non-owner sees a
 * disabled action with a clear reason instead of a submit-then-403 round trip, per the ticket brief's
 * explicit instruction to mirror how V1's Void action is gated.
 */
export function TransferFormSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open ? <TransferFormSheetBody onOpenChange={onOpenChange} /> : null}
    </Sheet>
  );
}

function TransferFormSheetBody({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("finance.accountsPage.transfer");
  const can = useCan();
  const canTransfer = can("finance.transfer");
  const createTransfer = useCreateTransfer();

  const form = useForm<TransferFormInput>({
    resolver: zodResolver(transferSchema),
    defaultValues: { fromAccountId: "", toAccountId: "", amount: undefined, feeAmount: undefined, transactionDate: format(new Date(), "yyyy-MM-dd"), notes: "" },
  });

  const amount = form.watch("amount");
  const feeAmount = form.watch("feeAmount");
  const total = computeTransferTotal(amount, feeAmount);

  async function onSubmit(values: TransferFormInput) {
    if (!canTransfer) return;
    try {
      await createTransfer.mutateAsync({
        fromFinancialAccountId: values.fromAccountId,
        toFinancialAccountId: values.toAccountId,
        amount: values.amount,
        feeAmount: values.feeAmount,
        transactionDate: values.transactionDate,
        notes: values.notes || undefined,
      });
      toast.success(t("successToast"));
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
        <SheetTitle className="text-xl font-bold text-foreground">{t("title")}</SheetTitle>
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

      {!canTransfer ? (
        <p className="mt-4 rounded-xl border border-warning bg-warning-tint p-3 text-sm text-warning-foreground">
          {t("ownerOnlyNotice")}
        </p>
      ) : null}

      <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-5" noValidate>
        <fieldset disabled={!canTransfer || createTransfer.isPending} className="flex flex-col gap-3">
          <Controller
            control={form.control}
            name="fromAccountId"
            render={({ field, fieldState }) => (
              <AccountPicker value={field.value} onChange={field.onChange} placeholder={t("fromPlaceholder")} error={fieldState.error?.message} />
            )}
          />
          <Controller
            control={form.control}
            name="toAccountId"
            render={({ field, fieldState }) => (
              <AccountPicker value={field.value} onChange={field.onChange} placeholder={t("toPlaceholder")} error={fieldState.error?.message} />
            )}
          />
          <Controller
            control={form.control}
            name="amount"
            render={({ field, fieldState }) => (
              <MoneyInput label={t("amount")} value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />
            )}
          />
          <Controller
            control={form.control}
            name="feeAmount"
            render={({ field, fieldState }) => (
              <MoneyInput label={t("feeAmount")} value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />
            )}
          />
          <Controller
            control={form.control}
            name="transactionDate"
            render={({ field, fieldState }) => (
              <DatePicker label={t("transactionDate")} value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
            )}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="transfer-notes">{t("notes")}</Label>
            <Textarea id="transfer-notes" rows={2} {...form.register("notes")} />
          </div>

          {total.amount > 0 ? (
            <div className="flex flex-col gap-1 rounded-xl bg-muted p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("summaryAmount")}</span>
                <MoneyText amount={total.amount} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("summaryFee")}</span>
                <MoneyText amount={total.fee} />
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-border pt-1 font-semibold text-foreground">
                <span>{t("summaryTotal")}</span>
                <MoneyText amount={total.totalDebited} />
              </div>
            </div>
          ) : null}
        </fieldset>

        <div className="mt-auto flex gap-2 pt-4">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => onOpenChange(false)} disabled={createTransfer.isPending}>
            {t("cancel")}
          </Button>
          <Button type="submit" className="flex-1" disabled={!canTransfer || createTransfer.isPending}>
            {createTransfer.isPending ? "…" : t("submit")}
          </Button>
        </div>
      </form>
    </SheetContent>
  );
}
