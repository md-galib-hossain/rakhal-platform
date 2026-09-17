"use client"; // form state (financial account) + a pending mutation click + a live shortfall preview

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, Info, PackageMinus, ShoppingCart } from "lucide-react";
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
import { MoneyText } from "@/components/shared/money-text";
import { AccountPicker } from "@/features/finance/components/account-picker";
import { useConcentrationFinalizePreview, useFinalizeConcentration } from "../hooks/use-feed";
import type { FeedConcentrationSummary } from "../types";

/**
 * Finalizing either kind — a Concentrate Mixer (`kind=CONCENTRATE_TEMPLATE`) or a Total Mixed
 * Ration (`kind=FEED_MIXTURE`) — is the Feed Formulator action that can cost real money: both
 * produce a `FeedStock` inventory lot and, for any line **not** linked to a batch already owned,
 * deduct that portion's cost from Finance (RAKHAL-423/424, MILESTONE 8c; RAKHAL-428 closed RD-090
 * by making a Concentrate Mixer's unlinked cost pay the same way a TMR's does — previously a
 * Concentrate finalize never required or posted payment regardless of unlinked cost, and this
 * dialog didn't apply to it; RFE-114 generalizes this dialog to cover both kinds instead of
 * duplicating it).
 *
 * **RFE-113 (2026-09-14)**: this dialog used to unconditionally require an account — exactly the
 * behavior RAKHAL-424 closed on the backend for an all-linked finalize. Fixed here: the account
 * picker, and the requirement to fill it, now only appear when `preview.unlinkedCostTk > 0`. Also
 * new: a live preview (`useConcentrationFinalizePreview`) showing what will be deducted from
 * inventory vs. purchased, and a hard block — Confirm stays disabled — when a linked batch doesn't
 * have enough stock, naming the shortfall rather than letting the farmer discover it from a bare
 * 400 after clicking Finalize. See that hook's doc comment for exactly what is and isn't checked
 * precisely (a `FeedItem` with no `kgPerUnit` conversion can't be checked here, same class of gap as
 * `BatchLinkPicker`'s — surfaced as "not checked", never silently assumed fine). Both the preview
 * hook and the finalize mutation are already kind-agnostic (they only ever needed an id) — the only
 * kind-specific part of this dialog is which copy strings to show.
 *
 * RAKHAL-393 (closes RD-066): uses the same `AccountPicker` (Popover+Command search-select + inline
 * quick-add) every other V2 money-movement form uses, so the farmer picks the exact account, not an
 * arbitrary one the backend guessed.
 */
export function FinalizeTmrDialog({
  target,
  onOpenChange,
}: {
  target: FeedConcentrationSummary | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("feed");
  const tPreview = useTranslations("feed.finalizePreview");
  const finalizeConcentration = useFinalizeConcentration();
  const preview = useConcentrationFinalizePreview(target?.id);
  const [financialAccountId, setFinancialAccountId] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);

  const isTemplate = target?.kind === "CONCENTRATE_TEMPLATE";
  const needsPayment = preview.unlinkedCostTk > 0;

  async function handleConfirm() {
    if (!target || (needsPayment && !financialAccountId)) return;
    setPending(true);
    try {
      await finalizeConcentration.mutateAsync({
        id: target.id,
        dto: needsPayment ? { financialAccountId } : {},
      });
      toast.success(t(isTemplate ? "finalizedToast" : "finalizedToastMixture"));
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
      <SheetContent side="right" className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t(isTemplate ? "finalizeConfirmTitle" : "finalizeConfirmTitleMixture")}</SheetTitle>
          <SheetDescription>{t(isTemplate ? "finalizeConfirmDescription" : "finalizeConfirmDescriptionMixture")}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3 py-3">
          {preview.isLoading ? (
            <p className="text-sm text-muted-foreground">{tPreview("loading")}</p>
          ) : (
            <>
              {preview.linkedLineCount > 0 ? (
                <div className="flex items-start gap-2 rounded-xl bg-muted/50 p-3">
                  <PackageMinus className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden />
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-medium text-foreground">{tPreview("deductingTitle")}</p>
                    <p className="text-xs text-muted-foreground">{tPreview("deductingCount", { count: preview.linkedLineCount })}</p>
                  </div>
                </div>
              ) : null}

              {needsPayment ? (
                <div className="flex items-start gap-2 rounded-xl bg-warning-tint p-3">
                  <ShoppingCart className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-medium text-foreground">
                      {tPreview("purchasingTitle")}: <MoneyText amount={preview.unlinkedCostTk} />
                    </p>
                    <p className="text-xs text-muted-foreground">{tPreview("purchasingAmount")}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-xl bg-success-tint p-3">
                  <Info className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  <p className="text-sm text-foreground">{tPreview("noPurchase")}</p>
                </div>
              )}

              {preview.shortfalls.length > 0 ? (
                <div className="flex flex-col gap-1.5 rounded-xl bg-destructive-tint p-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden />
                    <p className="text-sm font-medium text-destructive">{tPreview("shortfallTitle")}</p>
                  </div>
                  <ul className="flex flex-col gap-1 pl-6 text-xs text-destructive">
                    {preview.shortfalls.map((s) => (
                      <li key={s.name}>{tPreview("shortfall", { name: s.name, needed: s.neededKg, available: s.availableKg })}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {preview.unchecked.length > 0 ? (
                <div className="flex flex-col gap-1.5 rounded-xl bg-muted/50 p-3">
                  <p className="text-xs font-medium text-muted-foreground">{tPreview("uncheckedTitle")}</p>
                  <ul className="flex flex-col gap-1 pl-4 text-xs text-muted-foreground">
                    {preview.unchecked.map((u) => (
                      <li key={u.name}>{tPreview("unchecked", { name: u.name })}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}

          {needsPayment ? <AccountPicker value={financialAccountId} onChange={setFinancialAccountId} /> : null}
        </div>

        <SheetFooter className="border-t border-dashed border-border pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {t("finalizeMixtureCancel")}
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleConfirm()}
            disabled={pending || preview.isLoading || !preview.canFinalize || (needsPayment && !financialAccountId)}
          >
            {pending ? "…" : t(needsPayment ? "finalizeMixtureConfirm" : "finalizeMixtureConfirmNoPay")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
