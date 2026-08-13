"use client"; // live query + sheet open state

import { useTranslations } from "next-intl";
import { ArrowRightToLine } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { useCattleDetail } from "../../hooks/use-cattle";
import { CattleProfileCard } from "./cattle-profile-card";
import { CattleDetailTabs } from "./cattle-detail-tabs";
import type { CattleDetail } from "../../types";

/**
 * "Cattle Details" right-side drawer — Figma "Single Cow Details with options" frame (1042:57994):
 * a floating card inset 10px from the viewport edges (not a flush full-height panel), 20px corner
 * radius, 2px border. This is the **only** cattle detail view (no standalone `/cattle/:id` page —
 * that route now just redirects here via the `?view=` param `CattleTable` owns), so the header's
 * arrow icon closes the drawer rather than linking anywhere.
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
      <SheetContent
        showClose={false}
        className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:max-w-[820px] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5"
      >
        <div className="flex items-center justify-between pb-5">
          <SheetTitle className="text-xl font-bold text-foreground">{t("title")}</SheetTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={t("close")}
            className="flex size-5 items-center justify-center text-foreground transition-opacity hover:opacity-70"
          >
            <ArrowRightToLine className="size-5" aria-hidden />
          </button>
        </div>
        <div className="border-t border-border" />

        <div className="flex-1 overflow-y-auto py-4">
          {query.isLoading ? (
            <CardSkeleton lines={3} />
          ) : query.isError || !query.data ? (
            <ErrorState description={t("error")} onRetry={() => query.refetch()} />
          ) : (
            <div className="flex flex-col gap-6">
              <CattleProfileCard cattle={query.data} />
              <CattleDetailTabs
                cattleId={query.data.id}
                gender={query.data.gender}
                lactationStage={query.data.lactationStage}
                animalCategory={query.data.animalCategory}
              />
            </div>
          )}
        </div>

        <div className="border-t border-border" />
        <div className="flex gap-3 pt-5">
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
