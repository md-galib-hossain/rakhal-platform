"use client"; // form state + mutation

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRecordPayment } from "../hooks/use-finance";
import { recordPaymentSchema, type RecordPaymentInput } from "../schemas";
import type { ReceivableKind, Settlement } from "../types";

const METHODS = ["CASH", "BANK_TRANSFER", "MFS", "WALLET"] as const;

/**
 * Record Payment (Receivables/Payables settlement row action). No Figma frame for this modal —
 * built PRD-spec against the real `RecordPaymentDto`. Closes the real gap: settlement rows were
 * view-only, no way to settle an outstanding balance from the UI.
 */
export function RecordPaymentDialog({
  kind,
  settlement,
  open,
  onOpenChange,
}: {
  kind: ReceivableKind;
  settlement: Settlement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const namespace = kind === "RECEIVABLE" ? "finance.receivables" : "finance.payables";
  const t = useTranslations(namespace);
  const tMethods = useTranslations("finance.ledger");
  const recordPayment = useRecordPayment(kind);

  const form = useForm<RecordPaymentInput>({
    resolver: zodResolver(recordPaymentSchema),
    values: { amountPaid: settlement?.outstanding ?? 0, paymentMethod: "CASH", notes: "" },
  });

  async function onSubmit(values: RecordPaymentInput) {
    if (!settlement) return;
    try {
      await recordPayment.mutateAsync({ id: settlement.id, dto: values });
      toast.success(t("recordPayment.successToast"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("recordPayment.genericError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("recordPayment.title")}</DialogTitle>
          {settlement ? (
            <DialogDescription>
              {t("recordPayment.description", {
                entity: settlement.entityName ?? t("noEntity"),
                outstanding: settlement.outstanding,
              })}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="amountPaid">{t("recordPayment.amountPaid")}</Label>
            <Input
              id="amountPaid"
              type="number"
              step="0.01"
              min={0}
              error={form.formState.errors.amountPaid?.message}
              {...form.register("amountPaid", { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="paymentDate">{t("recordPayment.paymentDate")}</Label>
            <Input id="paymentDate" type="date" {...form.register("paymentDate")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("recordPayment.paymentMethod")}</Label>
            <Controller
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map((method) => (
                      <SelectItem key={method} value={method}>
                        {tMethods(`methodOptions.${method}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">{t("recordPayment.notes")}</Label>
            <Textarea id="notes" rows={2} {...form.register("notes")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={recordPayment.isPending}>
              {t("recordPayment.cancel")}
            </Button>
            <Button type="submit" disabled={recordPayment.isPending}>
              {recordPayment.isPending ? t("recordPayment.saving") : t("recordPayment.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
