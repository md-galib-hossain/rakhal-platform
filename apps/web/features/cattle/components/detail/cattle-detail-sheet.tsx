"use client"; // live query + sheet open state

import { useTranslations } from "next-intl";
import { ArrowRightToLine, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { useCan } from "@/lib/auth/permissions";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { RowActionsMenu } from "@/components/shared/row-actions-menu";
import { useCattleDetail, useRestoreCattle } from "../../hooks/use-cattle";
import { CattleProfileCard } from "./cattle-profile-card";
import { CattleDetailTabs } from "./cattle-detail-tabs";
import type { CattleDetail } from "../../types";

/**
 * "Cattle Details" right-side drawer — Figma "Single Cow Details with options" frame (1042:57994):
 * a floating card inset 10px from the viewport edges (not a flush full-height panel), 20px corner
 * radius, 2px border. This is the **only** cattle detail view (no standalone `/cattle/:id` page —
 * that route now just redirects here via the `?view=` param `CattleTable` owns), so the header's
 * arrow icon closes the drawer rather than linking anywhere.
 *
 * Edit/Dispose/Delete/Restore used to live in a per-row 3-dot menu (`CattleRowActions`) duplicating
 * the "View Details" entry point this sheet already is — folded in here instead (UX request, no
 * ticket #) so there's one way in for every animal action: Sell/Dispose sit in the primary footer
 * next to Edit, Delete/Restore (rarer, destructive-or-recovery) sit behind the header kebab.
 */
export function CattleDetailSheet({
  cattleId,
  onOpenChange,
  onEdit,
  onDispose,
  onDelete,
}: {
  cattleId: string | undefined;
  onOpenChange: (open: boolean) => void;
  onEdit: (cattle: CattleDetail) => void;
  onDispose: (cattle: CattleDetail) => void;
  onDelete: (cattle: CattleDetail) => void;
}) {
  const t = useTranslations("cattle.detail");
  const tActions = useTranslations("cattle.actions");
  const can = useCan();
  const canUpdate = can("cattle.update");
  const canDispose = can("cattle.dispose");
  const canDelete = can("cattle.delete");
  const query = useCattleDetail(cattleId);
  const restore = useRestoreCattle();
  const cattle = query.data;
  const isDeleted = cattle?.deletedAt != null;
  const isActive = cattle?.herdStatus === "ACTIVE";

  async function handleRestore() {
    if (!cattle) return;
    try {
      await restore.mutateAsync(cattle.id);
      toast.success(tActions("restoredToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tActions("genericError"));
    }
  }

  const showRestore = Boolean(cattle) && isDeleted && canUpdate;
  const showDelete = Boolean(cattle) && !isDeleted && canDelete;

  return (
    <Sheet open={Boolean(cattleId)} onOpenChange={onOpenChange}>
      <SheetContent
        showClose={false}
        className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:max-w-[820px] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5"
      >
        <div className="flex items-center justify-between pb-5">
          <SheetTitle className="text-xl font-bold text-foreground">{t("title")}</SheetTitle>
          <div className="flex items-center gap-3">
            {showRestore ? (
              <Button variant="ghost" size="icon" aria-label={tActions("restore")} onClick={handleRestore}>
                <RotateCcw className="size-4" />
              </Button>
            ) : null}
            {/* Delete is for duplicate/mistaken records only — kept behind the menu, away from Dispose/Edit. */}
            <RowActionsMenu
              menuLabel={t("moreActions")}
              actions={
                showDelete && cattle
                  ? [{ key: "delete", label: tActions("delete"), destructive: true, onSelect: () => onDelete(cattle) }]
                  : []
              }
            />
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label={t("close")}
              className="flex size-5 items-center justify-center text-foreground transition-opacity hover:opacity-70"
            >
              <ArrowRightToLine className="size-5" aria-hidden />
            </button>
          </div>
        </div>
        <div className="border-t border-border" />

        <div className="flex-1 overflow-y-auto px-1 py-4">
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
            {t("close")}
          </Button>
          {isActive && canDispose ? (
            <Button
              type="button"
              variant="outline"
              className="h-12 flex-1"
              onClick={() => cattle && onDispose(cattle)}
            >
              {tActions("dispose")}
            </Button>
          ) : null}
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
