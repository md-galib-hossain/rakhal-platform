"use client"; // form state + mutation

import { useForm } from "react-hook-form";
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
import { useVoidTransaction } from "../hooks/use-finance";
import { voidTransactionSchema, type VoidTransactionInput } from "../schemas";
import type { LedgerTransaction } from "../types";

/**
 * Void Transaction (Master Ledger row action, owner-only reversal). No Figma frame for this modal —
 * built PRD-spec against the real `VoidTransactionDto`. Closes the real gap: `ledger-view.tsx`'s own
 * doc comment flagged "the row-level Void action is deferred to the wizard/modals follow-up pass."
 */
export function VoidTransactionDialog({
  transaction,
  open,
  onOpenChange,
}: {
  transaction: LedgerTransaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("finance.ledger.voidDialog");
  const voidTransaction = useVoidTransaction();

  const form = useForm<VoidTransactionInput>({
    resolver: zodResolver(voidTransactionSchema),
    values: { reasonCategory: "", reasonNotes: "" },
  });

  async function onSubmit(values: VoidTransactionInput) {
    if (!transaction) return;
    try {
      await voidTransaction.mutateAsync({ id: transaction.id, dto: values });
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
          {transaction ? (
            <DialogDescription>
              {t("description", { reference: transaction.reference, amount: transaction.amount })}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="reasonCategory">{t("reasonCategory")}</Label>
            <Input
              id="reasonCategory"
              placeholder={t("reasonCategoryPlaceholder")}
              error={form.formState.errors.reasonCategory?.message}
              {...form.register("reasonCategory")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reasonNotes">{t("reasonNotes")}</Label>
            <Textarea id="reasonNotes" rows={3} {...form.register("reasonNotes")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={voidTransaction.isPending}>
              {t("cancel")}
            </Button>
            <Button type="submit" variant="destructive" disabled={voidTransaction.isPending}>
              {voidTransaction.isPending ? t("voiding") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
