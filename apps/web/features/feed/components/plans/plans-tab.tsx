"use client"; // list state + editor/apply/delete dialog open state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ClipboardList, Plus } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Pagination } from "@/components/shared/pagination";
import { Can } from "@/lib/auth/permissions";
import { useAnimalGroups, useCattleDetail } from "@/features/cattle/hooks/use-cattle";
import {
  useArchiveFeedPlan,
  useFeedPlanAssignments,
  useFeedPlansList,
  useRemoveFeedAssignment,
} from "../../hooks/use-feed-plans";
import type { FeedPlan, FeedPlanAssignment } from "../../plans-types";
import { ApplyPlanDialog, type ApplyTarget } from "./apply-plan-dialog";
import { PlanEditorSheet } from "./plan-editor-sheet";

const KIND_VARIANT = { PLAN: "secondary", TMR_SHORTCUT: "info", CONCENTRATE_SHORTCUT: "info" } as const;

const isApplied = (plan: FeedPlan) =>
  plan.applied_to.cattle_ids.length > 0 || plan.applied_to.group_ids.length > 0 || plan.applied_to.herd;

function CowName({ id }: { id: string }) {
  const cow = useCattleDetail(id);
  const d = cow.data;
  return <>{d ? (d.name ? `${d.name} (${d.tagNumber})` : d.tagNumber) : "…"}</>;
}

/** Where this plan is applied right now, one row per target with a Remove button. */
function PlanAssignments({ plan }: { plan: FeedPlan }) {
  const t = useTranslations("feed.plans.card");
  const assignments = useFeedPlanAssignments(plan.id);
  const groups = useAnimalGroups();
  const remove = useRemoveFeedAssignment();
  const [removing, setRemoving] = useState<FeedPlanAssignment | null>(null);

  const rows = assignments.data?.items ?? [];
  if (assignments.isLoading) return <CardSkeleton lines={1} />;
  if (rows.length === 0) return null;

  const groupName = (id: string | null) => (groups.data?.items ?? []).find((g) => g.id === id)?.name ?? "…";

  async function confirmRemove() {
    if (!removing) return;
    try {
      await remove.mutateAsync(removing.id);
      toast.success(t("removedToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <>
      <ul className="flex flex-col gap-1" aria-label={t("assignmentsTitle")}>
        {rows.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-2 rounded-md bg-muted px-2 py-1 text-xs">
            <span className="truncate text-foreground">
              {a.target_type === "HERD" ? (
                t("herd")
              ) : a.target_type === "GROUP" ? (
                t("group", { name: groupName(a.animal_group_id) })
              ) : (
                <CowName id={a.cattle_id as string} />
              )}
            </span>
            <Can I="feed.update">
              <button type="button" onClick={() => setRemoving(a)} className="shrink-0 text-destructive hover:underline">
                {t("removeProgram")}
              </button>
            </Can>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={removing != null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t("removeConfirmTitle")}
        description={t("removeConfirmDescription", { name: plan.name })}
        confirmLabel={t("removeProgram")}
        onConfirm={confirmRemove}
      />
    </>
  );
}

function PlanCard({
  plan,
  onEdit,
  onApply,
  onDelete,
}: {
  plan: FeedPlan;
  onEdit: () => void;
  onApply: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("feed.plans.card");
  const tKind = useTranslations("feed.plans.kind");
  const cows = plan.applied_to.cattle_ids.length;
  const groupsN = plan.applied_to.group_ids.length;
  const appliedSummary = [
    cows > 0 ? t("cows", { count: cows }) : null,
    groupsN > 0 ? t("groups", { count: groupsN }) : null,
    plan.applied_to.herd ? t("herd") : null,
  ].filter(Boolean);

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-medium text-foreground">{plan.name}</h3>
          <p className="text-xs text-muted-foreground">{t("totalKg", { kg: plan.total_kg_per_day })}</p>
        </div>
        <Badge variant={KIND_VARIANT[plan.kind]}>{tKind(plan.kind)}</Badge>
      </div>

      <ul className="flex flex-col gap-1 text-sm">
        {plan.lines.map((l) => (
          <li key={l.id} className="flex justify-between gap-2">
            <span className="truncate text-foreground">{l.name ?? "—"}</span>
            <span className="shrink-0 text-muted-foreground">{t("kgLine", { kg: l.kg_per_day })}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-1.5 border-t border-border pt-2">
        <p className="text-xs font-medium text-foreground">
          {appliedSummary.length > 0 ? `${t("appliedTo")}: ${appliedSummary.join(" · ")}` : t("notApplied")}
        </p>
        {appliedSummary.length > 0 ? <PlanAssignments plan={plan} /> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Can I="feed.update">
          <Button size="sm" onClick={onApply}>
            {t("apply")}
          </Button>
          <Button size="sm" variant="secondary" onClick={onEdit}>
            {t("edit")}
          </Button>
        </Can>
        <Can I="feed.delete">
          <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
            {t("delete")}
          </Button>
        </Can>
      </div>
    </article>
  );
}

/** Feed Formulator → "Feed Plans" tab (MILESTONE 27, RFE-126): the daily pattern per animal, and where it is applied. */
export function PlansTab() {
  const t = useTranslations("feed.plans");
  const [search, setSearch] = useState("");
  const list = useFeedPlansList({ search: search.trim() || undefined });
  const archive = useArchiveFeedPlan();
  const [editor, setEditor] = useState<{ open: boolean; planId: string | null }>({ open: false, planId: null });
  const [applyTarget, setApplyTarget] = useState<ApplyTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeedPlan | null>(null);

  // A plan that is still applied refuses to be archived (409) — so for those the confirmation is
  // "Remove from all & delete", one atomic action, decided up front from where it is applied.
  const forceDelete = deleteTarget != null && isApplied(deleteTarget);

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await archive.mutateAsync({ id: deleteTarget.id, removeAssignments: forceDelete });
      toast.success(t("card.deletedToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("card.genericError"));
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xl font-medium text-foreground">{t("title")}</p>
        <div className="flex items-center gap-2">
          <Input
            type="search"
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
          />
          <Can I="feed.create">
            <Button onClick={() => setEditor({ open: true, planId: null })}>
              <Plus className="size-4" aria-hidden />
              {t("create")}
            </Button>
          </Can>
        </div>
      </div>

      {list.isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
        </div>
      ) : list.isError ? (
        <ErrorState onRetry={() => list.refetch()} />
      ) : list.items.length === 0 ? (
        <EmptyState icon={ClipboardList} title={t("empty")} description={t("emptyHint")} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.items.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onEdit={() => setEditor({ open: true, planId: plan.id })}
              onApply={() => setApplyTarget({ kind: "plan", plan })}
              onDelete={() => setDeleteTarget(plan)}
            />
          ))}
        </div>
      )}

      {list.totalPages > 1 ? (
        <Pagination
          page={list.page}
          totalPages={list.totalPages}
          onPageChange={list.goToPage}
          isFetching={list.isFetching}
          pageSize={list.pageSize}
          onPageSizeChange={list.setPageSize}
        />
      ) : null}

      <PlanEditorSheet
        planId={editor.planId}
        open={editor.open}
        onOpenChange={(open) => setEditor((s) => ({ ...s, open }))}
      />
      <ApplyPlanDialog target={applyTarget} onOpenChange={(open) => !open && setApplyTarget(null)} />
      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={forceDelete ? t("card.forceDeleteTitle") : t("card.deleteConfirmTitle")}
        description={
          forceDelete ? t("card.forceDeleteDescription") : t("card.deleteConfirmDescription", { name: deleteTarget?.name ?? "" })
        }
        confirmLabel={forceDelete ? t("card.forceDelete") : t("card.delete")}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
