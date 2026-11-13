"use client"; // pending-mutation confirm dialog

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@rakhal/ui/ui/sheet";
import { Button } from "@rakhal/ui/ui/button";

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t(`${variant}.title`, { label: documentLabel })}</SheetTitle>
          <SheetDescription>{t(`${variant}.description`)}</SheetDescription>
        </SheetHeader>
        <SheetFooter className="border-t border-dashed border-border pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {t("cancelButton")}
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={pending}>
            {pending ? "…" : t(`${variant}.confirm`)}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
