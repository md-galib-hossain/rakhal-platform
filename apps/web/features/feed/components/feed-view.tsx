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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Can, useCan } from "@/lib/auth/permissions";
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
import { NutritionCalculator } from "./nutrition-calculator";
import type { FeedConcentrationKind, FeedConcentrationSummary, FeedGroup } from "../types";

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
  selectMode = false,
  selectedIds,
  onToggleSelect,
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
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}) {
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
              selectable={selectMode}
              selected={selectedIds?.has(item.id)}
              onToggleSelect={() => onToggleSelect?.(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Feed Formulator page body — Figma "Feed Formulator" list frame (`1048:33190`, file
 * `SCfMPdxP6vgW1uTxfqCtz7`): "Concentration Template" + "Feed Mixture" card sections. As of
 * 2026-07-18 these are split by the explicit, server-enforced `kind` field (see `types.ts`'s
 * `FeedConcentrationKind` doc comment) rather than the old implicit "does it have a target"
 * heuristic — each section's "Create" button opens `CreateFeedDialog` with that section's `kind`,
 * which drives Step 1 to show (Feed Mixture) or hide (Concentrate Mixer) the target fields. Edit
 * (user request 2026-07-17, no Figma frame) reuses that same wizard prefilled (`CreateFeedDialog`'s
 * `editId` prop), passing along the card's own `kind` so Step 1 renders correctly before the detail
 * fetch resolves; delete calls the already-existing `DELETE /feed/concentrations/:id` (soft-delete)
 * behind a `ConfirmDialog`, same pattern as `EquipmentView`'s archive flow. Finalize (user request
 * 2026-07-17/18 — promote a template into a reusable ingredient) is offered only on template cards.
 * A third "Nutrition Calculator" tab (user request 2026-07-18) hosts the standalone cow/group
 * requirement lookup (`nutrition-calculator.tsx`), independent of building a ration.
 */
export function FeedView() {
  const t = useTranslations("feed");
  const can = useCan();
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
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

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
      toast.success(t("finalizedToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Tabs defaultValue="formulator">
        <TabsList>
          <TabsTrigger value="formulator">{t("tabFormulator")}</TabsTrigger>
          <TabsTrigger value="calculator">{t("tabCalculator")}</TabsTrigger>
        </TabsList>

        <TabsContent value="formulator" className="flex flex-col gap-4">
          {can("feed.delete") ? (
            selectMode ? (
              <FeedBulkActionsBar
                selectedIds={[...selectedIds]}
                onCancel={exitSelectMode}
                onDone={exitSelectMode}
              />
            ) : (
              <Button variant="outline" size="sm" className="self-end" onClick={() => setSelectMode(true)}>
                {t("selectMode")}
              </Button>
            )
          ) : null}

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
            selectMode={selectMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
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
            selectMode={selectMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
          />
        </TabsContent>

        <TabsContent value="calculator">
          <NutritionCalculator />
        </TabsContent>
      </Tabs>

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
        title={t("finalizeConfirmTitle")}
        description={t("finalizeConfirmDescription")}
        confirmLabel={t("card.finalize")}
        variant="primary"
        onConfirm={handleFinalizeConfirm}
      />
    </div>
  );
}
