"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Search, Trash2 } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Can } from "@/lib/auth/permissions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DateText } from "@/components/shared/date-text";
import { useAppliedHealthPlans, useDeleteHealthCase } from "../hooks/use-health";
import { ProgressRing } from "./progress-ring";
import { EditAppliedPlanDialog } from "./edit-applied-plan-dialog";
import type { AppliedPlanListItem } from "../types";

/**
 * "Active Plans" section inside the Health Plan tab — shows every currently running applied health
 * plan instance (HealthCase rows where `healthPlanId IS NOT NULL`, active status). One row per
 * cow, displays plan name, animal, start date, progress, and Delete / Edit actions.
 *
 * Delete: soft-deletes the HealthCase → cancels all pending tasks.
 * Edit:   re-applies the plan with a new start date (see EditAppliedPlanDialog).
 */
export function ActivePlansSection() {
  const t = useTranslations("health.healthPlan.activePlans");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AppliedPlanListItem | null>(null);
  const [editTarget, setEditTarget] = useState<AppliedPlanListItem | null>(null);

  const query = useAppliedHealthPlans();
  const deleteCase = useDeleteHealthCase();

  // Client-side search filter (dataset is small — ≤50 rows, fetched in one page)
  const allItems = query.data?.items ?? [];
  const filtered = search
    ? allItems.filter(
        (item) =>
          item.healthPlan.name.toLowerCase().includes(search.toLowerCase()) ||
          (item.cattle.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
          item.cattle.tagNumber.toLowerCase().includes(search.toLowerCase()),
      )
    : allItems;

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteCase.mutateAsync(deleteTarget.id);
      toast.success(t("deleteToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("deleteError"));
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <section>
      {/* Section header */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-foreground">{t("sectionTitle")}</h3>
          {allItems.length > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {allItems.length}
            </span>
          )}
        </div>
        {allItems.length > 0 && (
          <div className="relative w-60">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="pl-9"
            />
          </div>
        )}
      </div>

      {/* Body */}
      {query.isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead className="bg-muted">
              <tr>
                {(["plan", "animal", "startDate", "progress", "actions"] as const).map((col) => (
                  <th
                    key={col}
                    className="h-[52px] px-4 text-left text-sm font-medium text-muted-foreground"
                  >
                    {t(`columns.${col}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const cattleName = item.cattle.name ?? item.cattle.tagNumber;
                return (
                  <tr
                    key={item.id}
                    className="border-t border-border transition-colors hover:bg-muted/30"
                  >
                    {/* Plan name */}
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">{item.healthPlan.name}</span>
                    </td>

                    {/* Animal */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="size-8 shrink-0">
                          {item.cattle.image && (
                            <AvatarImage src={item.cattle.image} alt={cattleName} />
                          )}
                          <AvatarFallback className="text-xs font-semibold">
                            {cattleName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{cattleName}</p>
                          <p className="text-xs text-muted-foreground">#{item.cattle.tagNumber}</p>
                        </div>
                      </div>
                    </td>

                    {/* Start date */}
                    <td className="px-4 py-3 text-muted-foreground">
                      <DateText date={item.startDate} />
                    </td>

                    {/* Progress */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ProgressRing value={item.progressPercentage} size={20} strokeWidth={3} />
                        <span className="text-sm text-muted-foreground">
                          {item.currentStep}/{item.totalSteps}
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Can I="healthcare.update">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-foreground"
                            onClick={() => setEditTarget(item)}
                            title={t("editTitle")}
                          >
                            <Pencil className="size-4" aria-hidden />
                          </Button>
                        </Can>
                        <Can I="healthcare.delete">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteTarget(item)}
                            title={t("deleteTitle")}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        </Can>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("deleteConfirmTitle")}
        description={
          deleteTarget
            ? t("deleteConfirmDescription", {
                animal: deleteTarget.cattle.name ?? deleteTarget.cattle.tagNumber,
                plan: deleteTarget.healthPlan.name,
              })
            : ""
        }
        confirmLabel={t("deleteConfirmLabel")}
        onConfirm={confirmDelete}
      />

      {/* Edit dialog */}
      <EditAppliedPlanDialog
        item={editTarget}
        open={Boolean(editTarget)}
        onOpenChange={(open) => !open && setEditTarget(null)}
      />
    </section>
  );
}
