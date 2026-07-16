"use client"; // fetches the detailed concentration on open

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { useConcentrationDetail, useFeedGroups } from "../hooks/use-feed";
import { FeedMixtureTable } from "./feed-mixture-table";
import { fromApiRequirements } from "../lib/formula-math";

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
  const feedGroups = useFeedGroups();

  const cowCount = useMemo(() => {
    if (!detail.data) return 1;
    if (detail.data.target_type === "INDIVIDUAL") return 1;
    return feedGroups.data?.find((g) => g.id === detail.data!.feed_group_id)?.assigned_count || 1;
  }, [detail.data, feedGroups.data]);

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

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4">
        {detail.isLoading ? (
          <CardSkeleton lines={4} />
        ) : detail.isError ? (
          <ErrorState onRetry={() => detail.refetch()} />
        ) : detail.data ? (
          <FeedMixtureTable
            items={detail.data.ingredients.map((line) => ({
              ingredientId: line.ingredient_id,
              ingredientName: line.name ?? line.ingredient_id,
              amountKg: line.amount_kg,
            }))}
            effectiveById={new Map()}
            requirements={detail.data.requirements ? fromApiRequirements(detail.data.requirements) : null}
            cowCount={cowCount}
            readOnly
            serverContributions={detail.data.ingredients.map((line) => ({
              ingredientId: line.ingredient_id,
              amountKg: line.amount_kg,
              dmKg: line.dm_kg,
              cpKg: line.cp_kg,
              meMj: line.me_mj,
              fatKg: line.fat_kg,
              ndfKg: line.ndf_kg,
              costTk: line.cost_tk,
            }))}
            serverTotals={{
              dmKg: detail.data.totals.dm_kg,
              cpKg: detail.data.totals.cp_kg,
              meMj: detail.data.totals.me_mj,
              fatKg: detail.data.totals.fat_kg,
              ndfKg: detail.data.totals.ndf_kg,
              totalCostTk: detail.data.totals.total_cost_tk,
            }}
          />
        ) : null}
      </div>
    </SheetContent>
  );
}
