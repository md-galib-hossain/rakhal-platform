"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowRight,
  ClipboardList,
  Globe,
  Layers,
  MoreHorizontal,
  Plus,
  Scale,
  Search,
  SearchX,
  Sparkles,
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

type FilterTab = "ALL" | "ACTIVE" | "UNASSIGNED";

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

  // Icon based on plan kind
  const kindIcon =
    plan.kind === "TMR_SHORTCUT" ? (
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-info-tint text-info">
        <Layers className="size-5" aria-hidden />
      </div>
    ) : plan.kind === "CONCENTRATE_SHORTCUT" ? (
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-warning-tint text-warning">
        <Sparkles className="size-5" aria-hidden />
      </div>
    ) : (
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Scale className="size-5" aria-hidden />
      </div>
    );

  return (
    <article className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-4.5 shadow-card transition-shadow hover:shadow-md">
      {/* Zone 1: Identity & Badges */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-3">
            {kindIcon}
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-base font-semibold text-foreground" title={plan.name}>
                {plan.name}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {applied ? (
                  <Badge variant="success" className="text-[11px] font-medium">
                    {isHerdOnly
                      ? t("appliedStatusHerd")
                      : t("appliedStatus", { count: totalAssignedCattle })}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[11px] text-muted-foreground">
                    {t("unassignedStatus")}
                  </Badge>
                )}
                {plan.kind !== "PLAN" && (
                  <Badge variant="secondary" className="text-[11px]">
                    {tKind(plan.kind)}
                  </Badge>
                )}
              </div>
            </div>
          </div>

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

        {/* Daily Per-Head Intake */}
        <div className="flex items-baseline gap-1.5 pt-1">
          <span className="text-lg font-bold tabular-nums text-foreground">
            {plan.total_kg_per_day.toFixed(1)} kg
          </span>
          <span className="text-xs text-muted-foreground">{t("perHeadDay")}</span>
        </div>
      </div>

      {/* Zone 2: Ration Composition Bar */}
      <div className="flex flex-col gap-1.5 border-t border-border pt-3">
        <p className="text-xs font-semibold text-foreground">{t("compositionTitle")}</p>
        <PlanProportionBar lines={plan.lines} totalKg={plan.total_kg_per_day} showLegend={true} />
      </div>

      {/* Zone 3: Herd Consumption Widget */}
      <div className="pt-1">
        {applied ? (
          <div className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/40 p-2.5">
            <div className="min-w-0 pr-2">
              <p className="text-xs font-semibold text-foreground">{t("herdDemand")}</p>
              <p className="text-[11px] text-muted-foreground">
                {isHerdOnly
                  ? t("herdDemandPerHead", { kg: plan.total_kg_per_day.toFixed(1) })
                  : t("herdDemandFormula", {
                      count: totalAssignedCattle,
                      kg: plan.total_kg_per_day.toFixed(1),
                    })}
              </p>
            </div>
            <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
              {isHerdOnly
                ? `${plan.total_kg_per_day.toFixed(1)} kg/head`
                : `${totalDemandKg} kg/day`}
            </span>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-2 text-center text-xs text-muted-foreground">
            {t("herdDemandUnassigned")}
          </div>
        )}
      </div>

      {/* Zone 4: Assigned Cattle Preview Strip */}
      <div className="flex flex-col gap-2 border-t border-border pt-3">
        {applied ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              {isHerdOnly ? (
                <div className="flex items-center gap-2">
                  <div className="flex size-6.5 items-center justify-center rounded-full bg-success-tint font-bold text-success ring-2 ring-card">
                    <Globe className="size-3.5" aria-hidden />
                  </div>
                  <span className="text-xs font-medium text-foreground">{t("herd")}</span>
                </div>
              ) : (
                <div className="flex items-center">
                  {plan.applied_to.cattle_ids.slice(0, 4).map((id) => (
                    <Avatar
                      key={id}
                      className={cn("size-6.5 -ml-1.5 first:ml-0 ring-2 ring-card", avatarTint(id))}
                    >
                      <AvatarFallback className={cn("text-[9px] font-bold uppercase", avatarTint(id))}>
                        {id.slice(-2)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {plan.applied_to.cattle_ids.length > 4 && (
                    <div className="-ml-1.5 flex size-6.5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-card">
                      +{plan.applied_to.cattle_ids.length - 4}
                    </div>
                  )}
                </div>
              )}
              <span className="text-xs font-medium text-muted-foreground">
                {isHerdOnly ? t("appliedStatusHerd") : t("cows", { count: totalAssignedCattle })}
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onViewAssigned}
              className="mt-1 w-full justify-between font-medium text-foreground hover:bg-muted"
            >
              <span>
                {isHerdOnly
                  ? t("viewAndManageHerd")
                  : t("viewAndManageCows", { count: totalAssignedCattle })}
              </span>
              <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 py-1 text-center">
            <span className="text-xs font-medium text-muted-foreground">{t("noCowsAssigned")}</span>
            <span className="text-[11px] text-muted-foreground">{t("applyPrompt")}</span>
          </div>
        )}

        {/* Zone 5: Card Actions */}
        <Can I="feed.update">
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button size="sm" variant="primary" onClick={onApply} className="flex-1">
              {t("apply")}
            </Button>
            <Button size="sm" variant="outline" onClick={onEdit} className="flex-1">
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
 * Displays daily feeding rations per head, live herd KPIs, ration proportion bars,
 * and the dedicated "Selected Cow See Mode" assigned cattle inspection dialog.
 */
export function PlansTab() {
  const t = useTranslations("feed.plans");
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<FilterTab>("ALL");

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

  // Live operational KPI metrics calculation
  const { totalPlans, activePlans, coveredCattleCount, totalHerdDemand } = useMemo(() => {
    const items = list.items;
    const active = items.filter(isApplied);

    let cattleSum = 0;
    let demandSum = 0;

    items.forEach((p) => {
      const pCows = p.applied_to.cattle_ids.length;
      const pGroupCows = p.applied_to.group_ids.reduce(
        (sum, gid) => sum + (groupMap.get(gid) ?? 0),
        0,
      );
      const planTotalCattle = pCows + pGroupCows;
      cattleSum += planTotalCattle;
      if (planTotalCattle > 0) {
        demandSum += p.total_kg_per_day * planTotalCattle;
      }
    });

    return {
      totalPlans: items.length,
      activePlans: active.length,
      coveredCattleCount: cattleSum,
      totalHerdDemand: demandSum.toFixed(0),
    };
  }, [list.items, groupMap]);

  // Tab filtered items
  const filteredItems = useMemo(() => {
    if (filterTab === "ACTIVE") return list.items.filter(isApplied);
    if (filterTab === "UNASSIGNED") return list.items.filter((p) => !isApplied(p));
    return list.items;
  }, [list.items, filterTab]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      {/* Header with Search and Create CTA */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-foreground">{t("title")}</h2>
          <p className="mt-0.5 max-w-prose text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
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

      {/* Operational KPI Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-xs">
          {t("metrics.totalPlans", { count: totalPlans })}
        </div>
        <div className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-xs">
          {t("metrics.activePlans", { count: activePlans })}
        </div>
        <div className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-xs">
          {t("metrics.coveredCattle", { count: coveredCattleCount })}
        </div>
        <div className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold tabular-nums text-foreground shadow-xs">
          {t("metrics.totalHerdDemand", { kg: totalHerdDemand })}
        </div>
      </div>

      {/* Segmented Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-3">
        <Button
          type="button"
          variant={filterTab === "ALL" ? "primary" : "outline"}
          size="sm"
          className="h-8 text-xs font-medium"
          onClick={() => setFilterTab("ALL")}
        >
          {t("filters.all", { count: list.items.length })}
        </Button>
        <Button
          type="button"
          variant={filterTab === "ACTIVE" ? "primary" : "outline"}
          size="sm"
          className="h-8 text-xs font-medium"
          onClick={() => setFilterTab("ACTIVE")}
        >
          {t("filters.active", { count: list.items.filter(isApplied).length })}
        </Button>
        <Button
          type="button"
          variant={filterTab === "UNASSIGNED" ? "primary" : "outline"}
          size="sm"
          className="h-8 text-xs font-medium"
          onClick={() => setFilterTab("UNASSIGNED")}
        >
          {t("filters.unassigned", { count: list.items.filter((p) => !isApplied(p)).length })}
        </Button>
      </div>

      {/* Plans Grid or Empty State */}
      {list.isLoading ? (
        <div className="grid grid-cols-1 gap-4.5 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
          <CardSkeleton lines={5} />
          <CardSkeleton lines={5} />
          <CardSkeleton lines={5} />
        </div>
      ) : list.isError ? (
        <ErrorState onRetry={() => list.refetch()} />
      ) : filteredItems.length === 0 && search.trim() ? (
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
      ) : list.items.length > 0 && filteredItems.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t("filters.emptyTitle")}
          description={t("filters.emptyHint")}
          action={
            <Button variant="outline" size="sm" onClick={() => setFilterTab("ALL")}>
              {t("filters.switchAll")}
            </Button>
          }
        />
      ) : filteredItems.length === 0 ? (
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
        <div className="grid grid-cols-1 gap-4.5 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map((plan) => (
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
