"use client"; // form state (payment method) + a pending mutation click

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LabeledSelectTrigger } from "@/components/ui/labeled-field";
import { Select, SelectContent, SelectItem } from "@/components/ui/select";
import { useFinalizeConcentration } from "../hooks/use-feed";
import type { FeedConcentrationSummary } from "../types";

// Same four-value set as `record-transaction-dialog.tsx`'s Inventory Purchase payment step —
// WALLET debits the farm's one wallet ledger (with a balance check), the other three just log the
// expense with no wallet side effect. Defaulted to WALLET for the same reason that dialog does:
// the common case needs no extra click.
const PAYMENT_METHODS = ["WALLET", "CASH", "BANK_TRANSFER", "MFS"] as const;

/**
 * Finalizing a Total Mixed Ration (TMR, `kind=FEED_MIXTURE`) is the one Feed Formulator action that
 * costs real money — it produces a `FeedStock` inventory lot and (as of this dialog) deducts that
 * lot's cost from Finance. A Concentrate Mixer finalize stays on the plain `ConfirmDialog` in
 * `feed-view.tsx` (free/virtual, no payment). Reuses `finance.record`'s payment-method copy
 * (`paymentMethodLabel`/`paymentMethodOptions.*`) instead of re-authoring the same four labels here.
 */
export function FinalizeTmrDialog({
  target,
  onOpenChange,
}: {
  target: FeedConcentrationSummary | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("feed");
  const tPayment = useTranslations("finance.record");
  const finalizeConcentration = useFinalizeConcentration();
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]>("WALLET");
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    if (!target) return;
    setPending(true);
    try {
      await finalizeConcentration.mutateAsync({ id: target.id, dto: { paymentMethod } });
      toast.success(t("finalizedToastMixture"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={target != null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("finalizeConfirmTitleMixture")}</DialogTitle>
          <DialogDescription>{t("finalizeConfirmDescriptionMixture")}</DialogDescription>
        </DialogHeader>

        <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as (typeof PAYMENT_METHODS)[number])}>
          <LabeledSelectTrigger label={tPayment("paymentMethodLabel")} />
          <SelectContent>
            {PAYMENT_METHODS.map((m) => (
              <SelectItem key={m} value={m}>
                {tPayment(`paymentMethodOptions.${m}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {t("finalizeMixtureCancel")}
          </Button>
          <Button variant="primary" onClick={() => void handleConfirm()} disabled={pending}>
            {pending ? "…" : t("finalizeMixtureConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
