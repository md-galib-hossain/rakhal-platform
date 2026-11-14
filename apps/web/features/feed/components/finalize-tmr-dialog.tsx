"use client"; // pending mutation click + which missing ingredient's "add to inventory" form is open

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, Check, CircleCheck, PackagePlus, PackageX } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Can } from "@/lib/auth/permissions";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@rakhal/ui/ui/sheet";
import { Button } from "@rakhal/ui/ui/button";
import { CardSkeleton } from "@rakhal/ui/shared/card-skeleton";
import { FeedItemFormDialog, type FeedItemPrefill } from "@/features/inventory/components/feed-item-form-dialog";
import { useConcentrationInventoryCheck, useFinalizeConcentration } from "../hooks/use-feed";
import type { FeedConcentrationSummary } from "../types";

const numberFmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));

/**
 * Finalizing either kind — a Concentrate Mixer (`kind=CONCENTRATE_TEMPLATE`) or a Total Mixed
 * Ration (`kind=FEED_MIXTURE`) — produces a `FeedStock` lot and **consumes the recipe's ingredients
 * from inventory**.
 *
 * **2026-09-24 (user request):** a recipe can be *built* from ingredients the farm doesn't stock, but
 * can only be *finalized* when every ingredient is already in inventory. So finalize never buys
 * anything and this sheet no longer asks for a wallet (the feed was paid for when it was bought into
 * Inventory) — this replaces RFE-113's account picker + client-side purchase preview. The backend's
 * `GET …/inventory-check` (the same check `finalize` enforces) drives everything here: a checklist of
 * every line, a clear "not in inventory yet" block naming what to add, and an **Add to inventory**
 * button per missing line that opens the real Inventory feed-item form, prefilled with that
 * ingredient's name/class/catalogue link. While that form is open this sheet steps aside (no stacked
 * modals); saving refreshes the check and this sheet comes back with the line ticked.
 */
export function FinalizeTmrDialog({
  target,
  onOpenChange,
}: {
  target: FeedConcentrationSummary | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("feed");
  const tInv = useTranslations("feed.finalizeInventory");
  const queryClient = useQueryClient();
  const finalizeConcentration = useFinalizeConcentration();
  const check = useConcentrationInventoryCheck(target?.id);
  const [pending, setPending] = useState(false);
  const [addFor, setAddFor] = useState<FeedItemPrefill | null>(null);

  const isTemplate = target?.kind === "CONCENTRATE_TEMPLATE";
  const data = check.data;
  const missing = data?.missing ?? [];

  async function handleConfirm() {
    if (!target || !data?.can_finalize) return;
    setPending(true);
    try {
      await finalizeConcentration.mutateAsync({ id: target.id, dto: {} });
      toast.success(t(isTemplate ? "finalizedToast" : "finalizedToastMixture"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
      // The backend re-checks at finalize time — refresh so a race (stock changed) shows the truth.
      void check.refetch();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Sheet open={target != null && addFor == null} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t(isTemplate ? "finalizeConfirmTitle" : "finalizeConfirmTitleMixture")}</SheetTitle>
            <SheetDescription>{t(isTemplate ? "finalizeConfirmDescription" : "finalizeConfirmDescriptionMixture")}</SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-3">
            {check.isLoading ? (
              <>
                <p className="text-sm text-muted-foreground">{tInv("loading")}</p>
                <CardSkeleton lines={4} />
              </>
            ) : check.isError || !data ? (
              <div className="flex flex-col items-start gap-2 rounded-xl bg-destructive-tint p-3">
                <p className="text-sm font-medium text-destructive">{tInv("checkError")}</p>
                <Button variant="outline" size="sm" onClick={() => void check.refetch()}>
                  {tInv("retry")}
                </Button>
              </div>
            ) : (
              <>
                {missing.length > 0 ? (
                  <div className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning-tint p-3">
                    <div className="flex items-start gap-2">
                      <PackageX className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                      <div className="flex flex-col gap-0.5">
                        <p className="text-sm font-semibold text-foreground">{tInv("missingTitle", { count: missing.length })}</p>
                        <p className="text-xs text-muted-foreground">{tInv("missingBody")}</p>
                      </div>
                    </div>
                    <ul className="flex flex-col gap-2">
                      {missing.map((m) => (
                        <li
                          key={m.ingredient_id ?? m.name}
                          className="flex items-center justify-between gap-2 rounded-lg bg-card p-2.5 shadow-xs"
                        >
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-medium text-foreground">{m.name}</span>
                            <span className="text-xs text-muted-foreground">{tInv("needs", { kg: numberFmt(m.amount_kg) })}</span>
                          </div>
                          {m.is_prepared_feed ? (
                            <span className="max-w-[45%] text-right text-xs text-muted-foreground">{tInv("preparedHint")}</span>
                          ) : (
                            <Can I="inventory.create" fallback={<span className="text-xs text-muted-foreground">{tInv("askForAccess")}</span>}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="shrink-0 gap-1.5"
                                onClick={() =>
                                  setAddFor({
                                    name: m.name,
                                    ingredientId: m.ingredient_id,
                                    feedClass: m.feed_class,
                                    feedSubType: m.feed_sub_type,
                                  })
                                }
                              >
                                <PackagePlus className="size-3.5" aria-hidden />
                                {tInv("addToInventory")}
                              </Button>
                            </Can>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-xl bg-success-tint p-3">
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                    <div className="flex flex-col gap-0.5">
                      <p className="text-sm font-semibold text-foreground">{tInv("allGoodTitle")}</p>
                      <p className="text-xs text-muted-foreground">{tInv("allGoodBody")}</p>
                    </div>
                  </div>
                )}

                {data.shortfalls.length > 0 ? (
                  <div className="flex flex-col gap-1.5 rounded-xl bg-destructive-tint p-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden />
                      <p className="text-sm font-medium text-destructive">{tInv("shortfallTitle")}</p>
                    </div>
                    <ul className="flex flex-col gap-1 pl-6 text-xs text-destructive">
                      {data.shortfalls.map((s) => (
                        <li key={s.name}>
                          {tInv("shortfall", { name: s.name, needed: numberFmt(s.needed_kg), available: numberFmt(s.available_kg) })}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-muted-foreground">{tInv("ingredientsTitle")}</p>
                  <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
                    {data.lines.map((l) => (
                      <li key={`${l.ingredient_id ?? l.name}-${l.feed_item_id ?? l.feed_stock_id ?? "x"}`} className="flex items-center justify-between gap-2 px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          {l.status === "IN_INVENTORY" ? (
                            <Check className="size-4 shrink-0 text-success" aria-hidden />
                          ) : (
                            <PackageX className="size-4 shrink-0 text-warning" aria-hidden />
                          )}
                          <span className="truncate text-sm text-foreground">{l.name}</span>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {l.status === "MISSING"
                            ? tInv("statusMissing")
                            : l.available_kg != null
                              ? tInv("inStock", { kg: numberFmt(l.available_kg) })
                              : tInv("inStockUnknown")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>

          <SheetFooter className="border-t border-dashed border-border pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              {t("finalizeMixtureCancel")}
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleConfirm()}
              disabled={pending || check.isLoading || !data?.can_finalize}
            >
              {pending ? "…" : t("finalizeMixtureConfirmNoPay")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <FeedItemFormDialog
        open={addFor != null}
        onOpenChange={(open) => {
          if (!open) setAddFor(null);
        }}
        prefill={addFor ?? undefined}
        onCreated={() => {
          // The new feed item may complete this recipe — re-run the check before the sheet returns.
          void queryClient.invalidateQueries({
            predicate: (q) => q.queryKey[0] === "feed" && q.queryKey[1] === "concentrations",
          });
        }}
      />
    </>
  );
}
