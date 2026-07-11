"use client"; // live query + sheet open state

import { useTranslations } from "next-intl";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { useCattleDetail } from "../../hooks/use-cattle";
import { CattleProfileCard } from "./cattle-profile-card";
import { CattleDetailTabs } from "./cattle-detail-tabs";
import type { CattleDetail } from "../../types";

/**
 * "Cattle Details" right-side quick-view drawer (Figma) — opened from the list row-actions menu
 * (`CattleRowActions`'s "View Details"). Reuses the same `CattleProfileCard` + `CattleDetailTabs`
 * the full `/cattle/:id` page (RFE-023) already renders rather than duplicating that data-fetching
 * and 5-tab layout — this is purely an alternate, faster presentation of the same detail view, not
 * a replacement for the route (still linked from the name cell for a bookmarkable deep link).
 */
export function CattleDetailSheet({
  cattleId,
  onOpenChange,
  onEdit,
}: {
  cattleId: string | undefined;
  onOpenChange: (open: boolean) => void;
  onEdit: (cattle: CattleDetail) => void;
}) {
  const t = useTranslations("cattle.detail");
  const query = useCattleDetail(cattleId);

  return (
    <Sheet open={Boolean(cattleId)} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <div className="flex items-center justify-between px-6 py-5">
          <SheetTitle className="text-xl font-bold text-foreground">{t("title")}</SheetTitle>
        </div>
        <div className="border-t border-dashed border-border" />

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {query.isLoading ? (
            <CardSkeleton lines={3} />
          ) : query.isError || !query.data ? (
            <ErrorState description={t("error")} onRetry={() => query.refetch()} />
          ) : (
            <div className="flex flex-col gap-4">
              <CattleProfileCard cattle={query.data} />
              <CattleDetailTabs cattleId={query.data.id} gender={query.data.gender} />
            </div>
          )}
        </div>

        <div className="border-t border-dashed border-border" />
        <div className="flex gap-3 px-6 py-5">
          <Button type="button" variant="secondary" className="h-12 flex-1" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            className="h-12 flex-1"
            disabled={!query.data}
            onClick={() => query.data && onEdit(query.data)}
          >
            {t("editProfile")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
