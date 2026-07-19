"use client"; // list state + create/edit/detail dialog + delete-confirm open state

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Wheat } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Can } from "@/lib/auth/permissions";
import {
  useConcentrations,
  useFeedGroups,
  useFinalizeConcentration,
  useRemoveConcentration,
} from "../hooks/use-feed";
import { ConcentrationCard } from "./concentration-card";
import { CreateFeedDialog } from "./create-feed-dialog";
import { ConcentrationDetailSheet } from "./concentration-detail-sheet";
import { FeedBulkActionsBar } from "./feed-bulk-actions-bar";
import { LogDistributionDialog } from "./log-distribution-dialog";
import type { FeedConcentrationKind, FeedConcentrationSummary, FeedGroup } from "../types";

/** One section's selection state (Concentrate Mixer and Total Mixed Ration (TMR) each get their own — user
 * request 2026-07-18 follow-up: no shared cross-section selection). No "select mode" toggle — a
 * card's always-visible checkbox (`ConcentrationCard`) starts the selection directly; the bulk bar
 * only appears once `selected.size > 0`. */
function useSectionSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAll(ids: string[]) {
    setSelected(new Set(ids));
  }
  function clear() {
    setSelected(new Set());
  }
  return { selected, toggle, selectAll, clear };
}

function ConcentrationSection({
  title,
  createLabel,
  items,
  isLoading,
  isError,
  onRetry,
  emptyDescription,
  feedGroupById,
  onSeeDetails,
  onCreate,
  onEdit,
  onDelete,
  onFinalize,
  onFeedToday,
  selection,
}: {
  title: string;
  createLabel: string;
  items: FeedConcentrationSummary[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  emptyDescription: string;
  feedGroupById: Map<string, FeedGroup>;
  onSeeDetails: (id: string) => void;
  onCreate: () => void;
  onEdit: (concentration: FeedConcentrationSummary) => void;
  onDelete: (concentration: FeedConcentrationSummary) => void;
  onFinalize?: (concentration: FeedConcentrationSummary) => void;
  onFeedToday?: (concentration: FeedConcentrationSummary) => void;
  selection: ReturnType<typeof useSectionSelection>;
}) {
  const ids = items.map((i) => i.id);
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-xl font-medium text-foreground">{title}</p>
        <Can I="feed.create">
          <Button variant="primary" size="sm" className="gap-2" onClick={onCreate}>
            <Plus className="size-[18px]" aria-hidden />
            {createLabel}
          </Button>
        </Can>
      </div>

      <FeedBulkActionsBar
        selectedIds={[...selection.selected]}
        allSelected={ids.length > 0 && ids.every((id) => selection.selected.has(id))}
        onSelectAll={() => selection.selectAll(ids)}
        onCancel={selection.clear}
        onDone={selection.clear}
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
        </div>
      ) : isError ? (
        <ErrorState onRetry={onRetry} />
      ) : items.length === 0 ? (
        <EmptyState icon={Wheat} title={emptyDescription} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {items.map((item) => (
            <ConcentrationCard
              key={item.id}
              concentration={item}
              feedGroup={item.feed_group_id ? feedGroupById.get(item.feed_group_id) : undefined}
              onSeeDetails={() => onSeeDetails(item.id)}
              onEdit={() => onEdit(item)}
              onDelete={() => onDelete(item)}
              onFinalize={onFinalize ? () => onFinalize(item) : undefined}
              onFeedToday={onFeedToday ? () => onFeedToday(item) : undefined}
              selected={selection.selected.has(item.id)}
              onToggleSelect={() => selection.toggle(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Feed Formulator page body — Figma "Feed Formulator" list frame (`1048:33190`, file
 * `SCfMPdxP6vgW1uTxfqCtz7`): "Concentrate Mixer" + "Total Mixed Ration (TMR)" card sections (renamed
 * from "Concentration Template"/"Feed Mixture" per user request 2026-07-18 follow-up — those two
 * names, plus "Feed Formulator" for the dialog title, had drifted inconsistently across the UI). As
 * of 2026-07-18 these are split by the explicit, server-enforced `kind` field (see `types.ts`'s
 * `FeedConcentrationKind` doc comment) rather than the old implicit "does it have a target"
 * heuristic — each section's "Create" button opens `CreateFeedDialog` with that section's `kind`,
 * which drives Step 1 to show (TMR) or hide (Concentrate Mixer) the target fields. Edit
 * (user request 2026-07-17, no Figma frame) reuses that same wizard prefilled (`CreateFeedDialog`'s
 * `editId` prop), passing along the card's own `kind` so Step 1 renders correctly before the detail
 * fetch resolves; delete calls the already-existing `DELETE /feed/concentrations/:id` (soft-delete)
 * behind a `ConfirmDialog`, same pattern as `EquipmentView`'s archive flow. Finalize (user request
 * 2026-07-17/18) is offered on both sections as of Phase 12.2 (2026-07-18) — a Concentrate Mixer
 * promotes into a reusable ingredient *and* produces stock; a TMR produces stock only (never an
 * ingredient, it's the final ration) — the confirm dialog's copy is kind-conditional to match.
 * Each section has its own independent multi-select (user request 2026-07-18 follow-up —
 * `useSectionSelection`, no shared cross-section selection and no separate "select mode" toggle).
 * The standalone Nutrition Calculator tab (2026-07-18) was merged back into the create/edit wizard's
 * Step 1/2 (`create-feed-dialog.tsx` now calls `useCattleOrGroupRequirements` directly) and removed.
 * "Feed Today" (Phase 12.4, 2026-07-18) — logs an actual feeding against a TMR's own target and
 * deducts its finalized stock lot; offered only on the TMR section (a Concentrate Mixer has no cow
 * target to feed), opening `LogDistributionDialog` via `feedTodayId` state.
 * A read-only "Feed Stock (Inventory)" list briefly lived on this page (2026-07-19) but was moved to
 * the existing Inventory page's new "Feed" tab per user feedback — "we have already a inventory...
 * no need to create the tmr feed inventory here" — see `features/inventory/components/feed-stock-view.tsx`.
 */
export function FeedView() {
  const t = useTranslations("feed");
  const concentrations = useConcentrations();
  const feedGroups = useFeedGroups();
  const removeConcentration = useRemoveConcentration();
  const finalizeConcentration = useFinalizeConcentration();
  const [createOpen, setCreateOpen] = useState(false);
  const [createKind, setCreateKind] = useState<FeedConcentrationKind>("CONCENTRATE_TEMPLATE");
  const [editId, setEditId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeedConcentrationSummary | null>(null);
  const [finalizeTarget, setFinalizeTarget] = useState<FeedConcentrationSummary | null>(null);
  const [feedTodayId, setFeedTodayId] = useState<string | null>(null);
  const templateSelection = useSectionSelection();
  const mixtureSelection = useSectionSelection();

  const feedGroupById = useMemo(() => new Map((feedGroups.data ?? []).map((g) => [g.id, g])), [feedGroups.data]);

  const templates = useMemo(
    () => (concentrations.data ?? []).filter((c) => c.kind === "CONCENTRATE_TEMPLATE"),
    [concentrations.data],
  );
  const mixtures = useMemo(
    () => (concentrations.data ?? []).filter((c) => c.kind === "FEED_MIXTURE"),
    [concentrations.data],
  );

  function openCreate(kind: FeedConcentrationKind) {
    setEditId(null);
    setCreateKind(kind);
    setCreateOpen(true);
  }

  function openEdit(concentration: FeedConcentrationSummary) {
    setEditId(concentration.id);
    setCreateKind(concentration.kind);
    setCreateOpen(true);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await removeConcentration.mutateAsync(deleteTarget.id);
      toast.success(t("deletedToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  async function handleFinalizeConfirm() {
    if (!finalizeTarget) return;
    try {
      await finalizeConcentration.mutateAsync(finalizeTarget.id);
      toast.success(finalizeTarget.kind === "FEED_MIXTURE" ? t("finalizedToastMixture") : t("finalizedToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ConcentrationSection
        title={t("concentrationTemplate")}
        createLabel={t("createNewTemplate")}
        items={templates}
        isLoading={concentrations.isLoading}
        isError={concentrations.isError}
        onRetry={() => concentrations.refetch()}
        emptyDescription={t("noTemplates")}
        feedGroupById={feedGroupById}
        onSeeDetails={setDetailId}
        onCreate={() => openCreate("CONCENTRATE_TEMPLATE")}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        onFinalize={setFinalizeTarget}
        selection={templateSelection}
      />
      <ConcentrationSection
        title={t("feedMixture")}
        createLabel={t("createNewFeed")}
        items={mixtures}
        isLoading={concentrations.isLoading}
        isError={concentrations.isError}
        onRetry={() => concentrations.refetch()}
        emptyDescription={t("noFeeds")}
        feedGroupById={feedGroupById}
        onSeeDetails={setDetailId}
        onCreate={() => openCreate("FEED_MIXTURE")}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        onFinalize={setFinalizeTarget}
        onFeedToday={(c) => setFeedTodayId(c.id)}
        selection={mixtureSelection}
      />

      <CreateFeedDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setEditId(null);
        }}
        editId={editId ?? undefined}
        kind={createKind}
      />
      <ConcentrationDetailSheet concentrationId={detailId} onOpenChange={(open) => !open && setDetailId(null)} />
      <LogDistributionDialog concentrationId={feedTodayId} onOpenChange={(open) => !open && setFeedTodayId(null)} />
      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("deleteConfirmTitle")}
        description={t("deleteConfirmDescription")}
        confirmLabel={t("card.delete")}
        onConfirm={handleDeleteConfirm}
      />
      <ConfirmDialog
        open={finalizeTarget != null}
        onOpenChange={(open) => !open && setFinalizeTarget(null)}
        title={
          finalizeTarget?.kind === "FEED_MIXTURE"
            ? t("finalizeConfirmTitleMixture")
            : t("finalizeConfirmTitle")
        }
        description={
          finalizeTarget?.kind === "FEED_MIXTURE"
            ? t("finalizeConfirmDescriptionMixture")
            : t("finalizeConfirmDescription")
        }
        confirmLabel={t("card.finalize")}
        variant="primary"
        onConfirm={handleFinalizeConfirm}
      />
    </div>
  );
}
