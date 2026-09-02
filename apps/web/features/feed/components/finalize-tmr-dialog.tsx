"use client"; // form state (financial account) + a pending mutation click

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AccountPicker } from "@/features/finance/components/account-picker";
import { useFinalizeConcentration } from "../hooks/use-feed";
import type { FeedConcentrationSummary } from "../types";

/**
 * Finalizing a Total Mixed Ration (TMR, `kind=FEED_MIXTURE`) is the one Feed Formulator action that
 * costs real money — it produces a `FeedStock` inventory lot and deducts that lot's cost from
 * Finance. A Concentrate Mixer finalize stays on the plain `ConfirmDialog` in `feed-view.tsx` (free/
 * virtual, no payment). RAKHAL-393 (closes RD-066): this dialog used to post a bare `paymentMethod`
 * (including the deleted V1 `WALLET` value) that the backend resolved to "the farm's oldest active
 * account of that type" — a real, documented stopgap. Now uses the same `AccountPicker`
 * (Popover+Command search-select + inline quick-add) every other V2 money-movement form uses, so
 * the farmer picks the exact account, not an arbitrary one the backend guessed.
 */
export function FinalizeTmrDialog({
  target,
  onOpenChange,
}: {
  target: FeedConcentrationSummary | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("feed");
  const finalizeConcentration = useFinalizeConcentration();
  const [financialAccountId, setFinancialAccountId] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    if (!target || !financialAccountId) return;
    setPending(true);
    try {
      await finalizeConcentration.mutateAsync({ id: target.id, dto: { financialAccountId } });
      toast.success(t("finalizedToastMixture"));
      onOpenChange(false);
      setFinancialAccountId(undefined);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Sheet open={target != null} onOpenChange={(open) => { if (!open) setFinancialAccountId(undefined); onOpenChange(open); }}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("finalizeConfirmTitleMixture")}</SheetTitle>
          <SheetDescription>{t("finalizeConfirmDescriptionMixture")}</SheetDescription>
        </SheetHeader>

        <AccountPicker value={financialAccountId} onChange={setFinancialAccountId} />

        <SheetFooter className="border-t border-dashed border-border pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {t("finalizeMixtureCancel")}
          </Button>
          <Button variant="primary" onClick={() => void handleConfirm()} disabled={pending || !financialAccountId}>
            {pending ? "…" : t("finalizeMixtureConfirm")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
