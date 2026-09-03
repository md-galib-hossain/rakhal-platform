"use client"; // form state + mutation

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LabeledInput } from "@/components/ui/labeled-field";
import { Button } from "@/components/ui/button";
import { useRecordReceipt } from "../../hooks/use-sales";
import type { DispatchRow } from "../../types";

/** RAKHAL-388 — `Confirm Receipt` row action (`PATCH /buyers/dispatches/:id/receipt`, RAKHAL-378):
 * records the volume actually received (+ optional driver), moving PENDING → DELIVERED. Body is
 * only mounted while `open` (same conditional-render-to-reset-form pattern
 * `RecordPurchaseDialog`/`RecordExpenseDialog` already use for their own `Sheet`s) — avoids
 * syncing prefill state via a `useEffect`, which would fire a synchronous `setState` inside an
 * effect on every dispatch-target change. */
export function ReceiptConfirmDialog({
  dispatch,
  open,
  onOpenChange,
}: {
  dispatch: DispatchRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open && dispatch ? <ReceiptConfirmDialogBody dispatch={dispatch} onOpenChange={onOpenChange} /> : null}
    </Sheet>
  );
}

function ReceiptConfirmDialogBody({
  dispatch,
  onOpenChange,
}: {
  dispatch: DispatchRow;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("sales.dispatches.receiptDialog");
  const recordReceipt = useRecordReceipt();
  const [volumeReceivedL, setVolumeReceivedL] = useState(String(dispatch.volumeReceivedL ?? dispatch.volumeDispatchedL));
  const [driverName, setDriverName] = useState(dispatch.driverName ?? "");

  async function handleConfirm() {
    try {
      await recordReceipt.mutateAsync({
        id: dispatch.id,
        dto: { volumeReceivedL: Number(volumeReceivedL), driverName: driverName.trim() || undefined },
      });
      toast.success(t("confirmedToast"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <SheetContent side="right" className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5 sm:max-w-md">
      <SheetHeader>
        <SheetTitle>{t("title", { number: dispatch.dispatchNumber })}</SheetTitle>
      </SheetHeader>
      <div className="flex flex-col gap-3">
        <LabeledInput
          id="volumeReceivedL"
          type="number"
          step="0.01"
          min={0}
          label={t("volumeReceivedL")}
          value={volumeReceivedL}
          onChange={(e) => setVolumeReceivedL(e.target.value)}
        />
        <LabeledInput id="driverName" label={t("driverName")} value={driverName} onChange={(e) => setDriverName(e.target.value)} />
      </div>
      <SheetFooter className="border-t border-dashed border-border pt-4">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={recordReceipt.isPending}>
          {t("cancel")}
        </Button>
        <Button onClick={handleConfirm} disabled={recordReceipt.isPending || volumeReceivedL === ""}>
          {recordReceipt.isPending ? "…" : t("confirm")}
        </Button>
      </SheetFooter>
    </SheetContent>
  );
}
