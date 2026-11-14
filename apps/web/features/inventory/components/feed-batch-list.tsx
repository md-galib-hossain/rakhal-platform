"use client"; // expandable rows + action state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Can } from "@/lib/auth/permissions";
import { Button } from "@rakhal/ui/ui/button";
import { Chip } from "@rakhal/ui/ui/chip";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { ConfirmDialog } from "@rakhal/ui/shared/confirm-dialog";
import { useResyncFeedBatchNutrition, useRevertFeedBatchNutrition } from "../hooks/use-inventory";
import { OPTIONAL_NUTRIENT_KEYS, type FeedItem, type FeedItemBatch } from "../types";
import { FeedBatchNutritionDialog } from "./feed-batch-nutrition-dialog";

/**
 * Batch list + per-batch nutrition panel for the feed item detail sheet (RFE-122, ADR-026). Lots are
 * shown in the order they will be used (oldest purchase first); the first lot that still has stock is
 * flagged "Next to use". Each lot shows its own cost and nutrition profile, expandable to every
 * measured nutrient. Editing appends a new profile (revert restores the previous one); a feed linked to
 * a catalogue ingredient whose head profile has drifted from it offers a one-click re-sync.
 */
export function FeedBatchList({ feedItem }: { feedItem: FeedItem }) {
  const t = useTranslations("inventory.feed.batches");
  const tFields = useTranslations("inventory.feed.nutrition");
  const revert = useRevertFeedBatchNutrition();
  const resync = useResyncFeedBatchNutrition();
  const [editing, setEditing] = useState<FeedItemBatch | null>(null);
  const [reverting, setReverting] = useState<FeedItemBatch | null>(null);

  const nextToUse = feedItem.batches.find((b) => b.currentStock > 0)?.id;
  const differs = feedItem.nutritionDiffersFromCatalogue ?? [];

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      toast.success(success);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  if (feedItem.batches.length === 0) {
    return <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {feedItem.batches.map((batch, index) => {
        const isHead = feedItem.nutrition?.id === batch.nutritionProfileId;
        const measured = OPTIONAL_NUTRIENT_KEYS.filter((key) => batch.nutrition[key] != null);
        return (
          <div key={batch.id} className="flex flex-col gap-3 rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{batch.batchCode ?? t("batchNumber", { n: index + 1 })}</p>
                {batch.id === nextToUse ? <Chip variant="primary">{t("nextToUse")}</Chip> : null}
                {batch.currentStock <= 0 ? <Chip variant="muted">{t("emptyBatch")}</Chip> : null}
              </div>
              <p className="text-xs text-muted-foreground">
                <DateText date={batch.purchaseDate} />
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">{t("stock")}</p>
                <p className="font-medium text-foreground">
                  {batch.currentStock} {feedItem.unit.symbol}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("cost")}</p>
                <p className="font-medium text-foreground">
                  <MoneyText amount={batch.costPerUnit} /> / {feedItem.unit.symbol}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-lg bg-muted px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-foreground">
                  {t("profileSummary", { dm: batch.nutrition.dmPct, cp: batch.nutrition.cpPct, me: batch.nutrition.meMjPerKgDm })}
                </p>
                <Chip variant="muted">{tFields(`sources.${batch.nutrition.nutritionSource}`)}</Chip>
              </div>
              {isHead && differs.length > 0 ? (
                <p className="text-xs text-warning">
                  {t("differsFromCatalogue", { fields: differs.map((k) => tFields(`fields.${k}`)).join(", ") })}
                </p>
              ) : null}
              <details>
                <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground">{t("allNutrients")}</summary>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 pt-2 text-xs sm:grid-cols-3">
                  <div>
                    <dt className="text-muted-foreground">{tFields("moistureShort")}</dt>
                    <dd className="text-foreground">{batch.nutrition.moisturePct}%</dd>
                  </div>
                  {measured.map((key) => (
                    <div key={key}>
                      <dt className="text-muted-foreground">{tFields(`fields.${key}`)}</dt>
                      <dd className="text-foreground">{batch.nutrition[key]}</dd>
                    </div>
                  ))}
                </dl>
                {measured.length === 0 ? <p className="pt-2 text-xs text-muted-foreground">{t("noOptional")}</p> : null}
                {batch.nutrition.sourceRef ? (
                  <p className="pt-2 text-xs text-muted-foreground">{t("sourceRef", { ref: batch.nutrition.sourceRef })}</p>
                ) : null}
                {batch.nutrition.note ? <p className="pt-1 text-xs text-muted-foreground">{batch.nutrition.note}</p> : null}
              </details>
            </div>

            <Can I="inventory.update">
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(batch)}>
                  {t("editNutrition")}
                </Button>
                {batch.nutrition.supersedesId ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => setReverting(batch)}>
                    {t("revert")}
                  </Button>
                ) : null}
                {isHead && feedItem.ingredientId && differs.length > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={resync.isPending}
                    onClick={() => void run(() => resync.mutateAsync({ id: feedItem.id, batchId: batch.id }), t("resyncedToast"))}
                  >
                    {t("resync")}
                  </Button>
                ) : null}
              </div>
            </Can>
          </div>
        );
      })}

      <FeedBatchNutritionDialog feedItemId={feedItem.id} batch={editing} onOpenChange={(open) => !open && setEditing(null)} />
      <ConfirmDialog
        open={reverting != null}
        onOpenChange={(open) => !open && setReverting(null)}
        title={t("revertTitle")}
        description={t("revertDescription")}
        confirmLabel={t("revert")}
        variant="primary"
        onConfirm={async () => {
          if (reverting) await run(() => revert.mutateAsync({ id: feedItem.id, batchId: reverting.id }), t("revertedToast"));
        }}
      />
    </div>
  );
}
