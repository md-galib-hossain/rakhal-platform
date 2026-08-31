"use client"; // pending-mutation confirm dialog

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type VoidDocumentVariant = "cancel" | "refund" | "void";

/**
 * RAKHAL-392 (MILESTONE 22, `BUSINESS_IA_PRD.md` §9.4, §16.2) — one shared void/refund confirm
 * dialog for Sale (`cancel`/`refund`, chosen by the caller from whether the sale has any allocated
 * payment) and Purchase/Expense (`void`, single action). Deliberately does **not** pre-compute
 * "why this can't be voided" client-side — the backend's own `VoidSaleUseCase`/`VoidDocumentUseCase`
 * already reject with a real, specific message ("this purchase has payments allocated — refund the
 * payment first") when allocations exist, surfaced here verbatim via `ApiError.message` rather than
 * guessed/duplicated client-side logic that could drift from the real rule. */
export function VoidDocumentDialog({
  open,
  onOpenChange,
  variant,
  documentLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: VoidDocumentVariant;
  documentLabel: string;
  onConfirm: () => Promise<unknown>;
}) {
  const t = useTranslations("finance.voidDocument");
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    setPending(true);
    try {
      await onConfirm();
      toast.success(t(`${variant}.successToast`, { label: documentLabel }));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t(`${variant}.title`, { label: documentLabel })}</DialogTitle>
          <DialogDescription>{t(`${variant}.description`)}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {t("cancelButton")}
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={pending}>
            {pending ? "…" : t(`${variant}.confirm`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
