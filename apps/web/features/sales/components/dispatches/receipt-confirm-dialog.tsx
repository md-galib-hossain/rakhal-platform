"use client"; // form state + mutation

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && dispatch ? <ReceiptConfirmDialogBody dispatch={dispatch} onOpenChange={onOpenChange} /> : null}
    </Dialog>
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
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{t("title", { number: dispatch.dispatchNumber })}</DialogTitle>
      </DialogHeader>
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
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={recordReceipt.isPending}>
          {t("cancel")}
        </Button>
        <Button onClick={handleConfirm} disabled={recordReceipt.isPending || volumeReceivedL === ""}>
          {recordReceipt.isPending ? "…" : t("confirm")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
