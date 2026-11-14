"use client"; // fetches the detailed concentration on open

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@rakhal/ui/ui/sheet";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { useConcentrationDetail, useFeedIngredients } from "../hooks/use-feed";
import { FeedMixtureTable, toEffectiveMap } from "./feed-mixture-table";
import { fromApiRequirements } from "../lib/formula-math";
import { effectiveFromFigures, formLineKey } from "../lib/recipe-line";

/** Read-only "See Details" view (no dedicated Figma frame supplied this pass — the list page's card
 * only shows a "See Details" button) — reuses the same `FeedMixtureTable` the create wizard's Step 2
 * uses, in `readOnly` mode, sourced from `GET /feed/concentrations/:id`'s real per-line totals
 * (not recomputed client-side, unlike the wizard's live preview). */
export function ConcentrationDetailSheet({
  concentrationId,
  onOpenChange,
}: {
  concentrationId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={concentrationId != null} onOpenChange={onOpenChange}>
      {concentrationId ? <DetailBody id={concentrationId} onOpenChange={onOpenChange} /> : null}
    </Sheet>
  );
}

function DetailBody({ id, onOpenChange }: { id: string; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("feed.detail");
  const detail = useConcentrationDetail(id);
  const ingredients = useFeedIngredients();
  const detailDuration = detail.data?.duration_days;
  // The user's own edit, remembered together with the server value it was made against. When the server
  // value changes the edit is dropped and the new value shows, which is what the old sync effect did.
  const [edit, setEdit] = useState<{ base: number | null | undefined; days: number } | null>(null);
  const durationDays =
    edit && edit.base === detailDuration ? edit.days : detailDuration && detailDuration > 0 ? detailDuration : 1;
  const setDurationDays = (days: number) => setEdit({ base: detailDuration, days });

  // Needed only for the per-line "rate" annotation (e.g. "20%" DM) shown alongside the server-
  // computed kg values below — the kg/cost figures themselves come from `serverContributions`.
  const catalogueEffective = useMemo(() => toEffectiveMap(ingredients.data ?? []), [ingredients.data]);
  // A lot-backed line (RAKHAL-447) is computed from its lot, not the catalogue — recover its per-kg
  // rates from the figures the server already returned for that line.
  const effectiveById = useMemo(() => {
    const map = new Map(catalogueEffective);
    for (const line of detail.data?.ingredients ?? []) {
      if (!line.feed_item_id) continue;
      const eff = effectiveFromFigures(line);
      if (eff) map.set(formLineKey({ ingredientId: line.ingredient_id, feedItemId: line.feed_item_id, feedItemBatchId: line.feed_item_batch_id }), eff);
    }
    return map;
  }, [catalogueEffective, detail.data]);
  const lineRef = (line: NonNullable<typeof detail.data>["ingredients"][number]) => ({
    ingredientId: line.ingredient_id,
    feedItemId: line.feed_item_id,
    feedItemBatchId: line.feed_item_batch_id,
  });

  // Per-cow figures only — a herd-wide ration has no fixed head count here.
  const cowCount = 1;

  return (
    <SheetContent
      showClose={false}
      // Same wide-panel sizing as the create wizard's Step 2 (Figma `1065:35817`/`1065:35331`,
      // spanning almost the full content width up to the sidebar) — this view reuses that exact
      // table layout, so it gets the same width rather than the wizard's narrower Step 1 size.
      // `sm:max-w-none` explicitly overrides `SheetContent`'s own `side="right"` `sm:max-w-sm` —
      // an unprefixed `max-w-none` alone doesn't reliably win that cascade (see create-feed-dialog.tsx).
      className="inset-y-2.5 left-2.5 right-2.5 flex h-[calc(100vh-20px)] w-auto max-w-none flex-col gap-0 rounded-[20px] border-2 border-border p-5 shadow-2xl sm:max-w-none lg:left-[16.25rem]"
    >
      <div className="flex items-start justify-between pb-5">
        <SheetTitle className="text-xl font-bold text-foreground">{detail.data?.name ?? t("title")}</SheetTitle>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label={t("close")}
          className="flex size-5 shrink-0 items-center justify-center text-foreground transition-opacity hover:opacity-70"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <div className="border-t border-dashed border-border" />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-4">
        {detail.isLoading ? (
          <CardSkeleton lines={4} />
        ) : detail.isError ? (
          <ErrorState onRetry={() => detail.refetch()} />
        ) : detail.data ? (
          <FeedMixtureTable
            items={detail.data.ingredients.map((line) => ({
              ingredientId: line.ingredient_id ?? undefined,
              feedItemId: line.feed_item_id ?? undefined,
              feedItemBatchId: line.feed_item_batch_id ?? undefined,
              ingredientName: line.name ?? line.ingredient_id ?? "",
              amountKg: line.amount_kg,
            }))}
            effectiveById={effectiveById}
            requirements={detail.data.requirements ? fromApiRequirements(detail.data.requirements) : null}
            cowCount={cowCount}
            durationDays={durationDays}
            onDurationDaysChange={setDurationDays}
            showPerCow={detail.data.kind !== "CONCENTRATE_TEMPLATE"}
            readOnly
            serverContributions={detail.data.ingredients.map((line) => ({
              ingredientId: formLineKey(lineRef(line)),
              amountKg: line.amount_kg,
              dmKg: line.dm_kg,
              cpKg: line.cp_kg,
              meMj: line.me_mj,
              fatKg: line.fat_kg,
              ndfKg: line.ndf_kg,
              rdpKg: line.rdp_kg,
              rupKg: line.rup_kg,
              starchKg: line.starch_kg,
              adfKg: line.adf_kg,
              calciumKg: line.calcium_kg,
              phosphorusKg: line.phosphorus_kg,
              tdnKg: line.tdn_kg,
              costTk: line.cost_tk,
            }))}
            serverTotals={{
              dmKg: detail.data.totals.dm_kg,
              cpKg: detail.data.totals.cp_kg,
              meMj: detail.data.totals.me_mj,
              fatKg: detail.data.totals.fat_kg,
              ndfKg: detail.data.totals.ndf_kg,
              rdpKg: detail.data.totals.rdp_kg,
              rupKg: detail.data.totals.rup_kg,
              starchKg: detail.data.totals.starch_kg,
              adfKg: detail.data.totals.adf_kg,
              calciumKg: detail.data.totals.calcium_kg,
              phosphorusKg: detail.data.totals.phosphorus_kg,
              tdnKg: detail.data.totals.tdn_kg,
              totalCostTk: detail.data.totals.total_cost_tk,
            }}
          />
        ) : null}
      </div>
    </SheetContent>
  );
}
