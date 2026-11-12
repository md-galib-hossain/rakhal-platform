"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowRight,
  ClipboardList,
  Globe,
  MoreHorizontal,
  Plus,
  Search,
  SearchX,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Pagination } from "@/components/shared/pagination";
import { Can, useCan } from "@/lib/auth/permissions";
import { avatarTint } from "@/features/cattle/avatar-tint";
import { useAnimalGroups } from "@/features/cattle/hooks/use-cattle";
import {
  useArchiveFeedPlan,
  useFeedPlansList,
} from "../../hooks/use-feed-plans";
import type { FeedPlan } from "../../plans-types";
import { ApplyPlanDialog, type ApplyTarget } from "./apply-plan-dialog";
import { AssignedCattleDialog } from "./assigned-cattle-dialog";
import { PlanEditorSheet } from "./plan-editor-sheet";
import { PlanProportionBar } from "./plan-proportion-bar";

const isApplied = (plan: FeedPlan) =>
  plan.applied_to.cattle_ids.length > 0 ||
  plan.applied_to.group_ids.length > 0 ||
  plan.applied_to.herd;

function PlanCard({
  plan,
  groupMap,
  onEdit,
  onApply,
  onDelete,
  onViewAssigned,
}: {
  plan: FeedPlan;
  groupMap: Map<string, number>;
  onEdit: () => void;
  onApply: () => void;
  onDelete: () => void;
  onViewAssigned: () => void;
}) {
  const t = useTranslations("feed.plans.card");
  const tKind = useTranslations("feed.plans.kind");
  const canDelete = useCan()("feed.delete");

  const applied = isApplied(plan);
  const cowsCount = plan.applied_to.cattle_ids.length;
  const groupCowsCount = plan.applied_to.group_ids.reduce(
    (sum, gid) => sum + (groupMap.get(gid) ?? 0),
    0,
  );
  const isHerd = plan.applied_to.herd;
  const totalAssignedCattle = cowsCount + groupCowsCount;
  const isHerdOnly = isHerd && totalAssignedCattle === 0;
  const totalDemandKg = (plan.total_kg_per_day * totalAssignedCattle).toFixed(1);

  return (
    <article className="flex h-full flex-col justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-base font-semibold text-foreground" title={plan.name}>
            {plan.name}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
            {t("totalKg", { kg: plan.total_kg_per_day })}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {plan.kind !== "PLAN" && (
            <Badge variant="secondary" className="text-[11px]">
              {tKind(plan.kind)}
            </Badge>
          )}
          {canDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("moreActions", { name: plan.name })}
                  className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <MoreHorizontal className="size-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onDelete} className="text-destructive">
                  {t("delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Middle: Ration composition with the chart */}
      <div className="flex flex-col gap-1.5">
        <PlanProportionBar lines={plan.lines} totalKg={plan.total_kg_per_day} showLegend={true} />
      </div>

      {/* Clean Ending Bottom */}
      <div className="mt-auto flex flex-col gap-3 border-t border-border pt-3">
        {applied ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {isHerdOnly ? (
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-success-tint font-bold text-success ring-1 ring-border">
                  <Globe className="size-3.5" aria-hidden />
                </div>
              ) : (
                <div className="flex shrink-0 items-center">
                  {plan.applied_to.cattle_ids.slice(0, 3).map((id) => (
                    <Avatar
                      key={id}
                      className={cn("size-6.5 -ml-1.5 first:ml-0 ring-2 ring-card", avatarTint(id))}
                    >
                      <AvatarFallback className={cn("text-[9px] font-bold uppercase", avatarTint(id))}>
                        {id.slice(-2)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {plan.applied_to.cattle_ids.length > 3 && (
                    <div className="-ml-1.5 flex size-6.5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-card">
                      +{plan.applied_to.cattle_ids.length - 3}
                    </div>
                  )}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-foreground">
                  {isHerdOnly ? t("herd") : t("cows", { count: totalAssignedCattle })}
                </p>
                <p className="truncate text-[11px] text-muted-foreground tabular-nums">
                  {isHerdOnly
                    ? `${plan.total_kg_per_day.toFixed(1)} kg/head`
                    : `${totalDemandKg} kg/day total`}
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onViewAssigned}
              className="shrink-0 gap-1 text-xs font-medium text-foreground hover:bg-muted"
            >
              <span>{t("viewAssigned")}</span>
              <ArrowRight className="size-3.5" aria-hidden />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground">
              {t("notApplied")}
            </Badge>
            <span className="truncate text-right text-[11px] text-muted-foreground">
              {t("herdDemandUnassigned")}
            </span>
          </div>
        )}

        {/* Pinned Bottom Actions Row */}
        <Can I="feed.update">
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={onApply} className="flex-1">
              {t("apply")}
            </Button>
            <Button size="sm" variant="secondary" onClick={onEdit} className="flex-1">
              {t("edit")}
            </Button>
          </div>
        </Can>
      </div>
    </article>
  );
}

/**
 * Feed Formulator → Feed Plans tab.
 * Displays daily feeding rations per head, ration proportion bars,
 * and the dedicated assigned cattle inspection dialog.
 */
export function PlansTab() {
  const t = useTranslations("feed.plans");
  const [search, setSearch] = useState("");

  const list = useFeedPlansList({ search: search.trim() || undefined });
  const groups = useAnimalGroups();
  const archive = useArchiveFeedPlan();

  const groupMap = useMemo(
    () => new Map((groups.data?.items ?? []).map((g) => [g.id, g.memberCount ?? 0])),
    [groups.data],
  );

  const [editor, setEditor] = useState<{ open: boolean; planId: string | null }>({
    open: false,
    planId: null,
  });
  const [applyTarget, setApplyTarget] = useState<ApplyTarget | null>(null);
  const [assignedPlan, setAssignedPlan] = useState<FeedPlan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeedPlan | null>(null);

  const activeAssignedPlan = list.items.find((p) => p.id === assignedPlan?.id) ?? assignedPlan;

  const forceDelete = deleteTarget != null && isApplied(deleteTarget);

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await archive.mutateAsync({ id: deleteTarget.id, removeAssignments: forceDelete });
      toast.success(t("card.deletedToast"));
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("card.genericError"));
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 rounded-2xl bg-card p-4 shadow-card">
      {/* Header with Search and Create CTA */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-foreground">{t("title")}</h2>
          <p className="mt-0.5 max-w-prose text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-8"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            )}
          </div>
          <Can I="feed.create">
            <Button
              variant="primary"
              className="shrink-0 gap-1.5"
              onClick={() => setEditor({ open: true, planId: null })}
            >
              <Plus className="size-4" aria-hidden />
              {t("create")}
            </Button>
          </Can>
        </div>
      </div>

      {/* Plans Grid or Empty State */}
      {list.isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <CardSkeleton lines={5} />
          <CardSkeleton lines={5} />
          <CardSkeleton lines={5} />
        </div>
      ) : list.isError ? (
        <ErrorState onRetry={() => list.refetch()} />
      ) : list.items.length === 0 && search.trim() ? (
        <EmptyState
          icon={SearchX}
          title={t("noMatch", { query: search.trim() })}
          description={t("noMatchHint")}
          action={
            <Button variant="outline" size="sm" onClick={() => setSearch("")}>
              {t("clearSearch")}
            </Button>
          }
        />
      ) : list.items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t("empty")}
          description={t("emptyHint")}
          action={
            <Can I="feed.create">
              <Button variant="primary" onClick={() => setEditor({ open: true, planId: null })}>
                <Plus className="size-4" aria-hidden />
                {t("create")}
              </Button>
            </Can>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.items.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              groupMap={groupMap}
              onEdit={() => setEditor({ open: true, planId: plan.id })}
              onApply={() => setApplyTarget({ kind: "plan", plan })}
              onDelete={() => setDeleteTarget(plan)}
              onViewAssigned={() => setAssignedPlan(plan)}
            />
          ))}
        </div>
      )}

      {list.totalPages > 1 && (
        <Pagination
          page={list.page}
          totalPages={list.totalPages}
          onPageChange={list.goToPage}
          isFetching={list.isFetching}
          pageSize={list.pageSize}
          onPageSizeChange={list.setPageSize}
        />
      )}

      {/* Editor Sheet */}
      <PlanEditorSheet
        planId={editor.planId}
        open={editor.open}
        onOpenChange={(open) => setEditor((s) => ({ ...s, open }))}
      />

      {/* Apply Plan Dialog */}
      <ApplyPlanDialog
        target={applyTarget}
        onOpenChange={(open) => !open && setApplyTarget(null)}
      />

      {/* Dedicated Assigned Cattle Inspection Dialog ("Selected Cow See Mode") */}
      <AssignedCattleDialog
        plan={activeAssignedPlan}
        open={assignedPlan != null}
        onOpenChange={(open) => !open && setAssignedPlan(null)}
        onApplyMore={() => {
          if (activeAssignedPlan) {
            setApplyTarget({ kind: "plan", plan: activeAssignedPlan });
          }
        }}
      />

      {/* Delete / Archive Confirmation Dialog */}
      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={forceDelete ? t("card.forceDeleteTitle") : t("card.deleteConfirmTitle")}
        description={
          forceDelete
            ? t("card.forceDeleteDescription")
            : t("card.deleteConfirmDescription", { name: deleteTarget?.name ?? "" })
        }
        confirmLabel={forceDelete ? t("card.forceDelete") : t("card.delete")}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
