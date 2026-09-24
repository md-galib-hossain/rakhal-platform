"use client"; // list state + create/edit/detail dialog + delete-confirm open state

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Wheat } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { BulkActionDock } from "@/components/shared/bulk-action-dock";
import { Can } from "@/lib/auth/permissions";
import { useGridBulkSelection } from "@/lib/hooks/use-bulk-selection";
import {
  useBulkDeleteConcentrations,
  useConcentrations,
  useRemoveConcentration,
} from "../hooks/use-feed";
import { ConcentrationCard } from "./concentration-card";
import { RequirementsTab } from "./requirements-tab";
import { IngredientManagementTable } from "./ingredient-management-table";
import { CreateFeedDialog } from "./create-feed-dialog";
import { ConcentrationDetailSheet } from "./concentration-detail-sheet";
import { LogDistributionDialog } from "./log-distribution-dialog";
import { FinalizeTmrDialog } from "./finalize-tmr-dialog";
import type { FeedConcentrationKind, FeedConcentrationSummary } from "../types";

function ConcentrationSection({
  title,
  createLabel,
  items,
  isLoading,
  isError,
  onRetry,
  emptyDescription,
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
  onSeeDetails: (id: string) => void;
  onCreate: () => void;
  onEdit: (concentration: FeedConcentrationSummary) => void;
  onDelete: (concentration: FeedConcentrationSummary) => void;
  onFinalize?: (concentration: FeedConcentrationSummary) => void;
  onFeedToday?: (concentration: FeedConcentrationSummary) => void;
  selection: { isSelected: (id: string) => boolean; toggle: (id: string) => void };
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-xl font-medium text-foreground">{title}</p>
        <Can I="feed.create">
          <Button onClick={onCreate}>
            <Plus className="size-4" aria-hidden />
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
              onSeeDetails={() => onSeeDetails(item.id)}
              onEdit={() => onEdit(item)}
              onDelete={() => onDelete(item)}
              onFinalize={onFinalize ? () => onFinalize(item) : undefined}
              onFeedToday={onFeedToday ? () => onFeedToday(item) : undefined}
              selected={selection.isSelected(item.id)}
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
 * ingredient, it's the final ration). Both sections share one `FinalizeTmrDialog` instance (RFE-114,
 * 2026-09-15) — its shortfall/cost-split preview and payment requirement are kind-agnostic since
 * RAKHAL-428 made a Concentrate Mixer's unlinked cost pay the same way a TMR's does (closes RD-090);
 * only the dialog's copy strings are kind-conditional.
 * Each section has its own independent multi-select (user request 2026-07-18 follow-up — no shared
 * cross-section selection and no separate "select mode" toggle; migrated 2026-07-21 onto the shared
 * `useGridBulkSelection`/`BulkActionDock` — mutual exclusion between the two sections' selections,
 * enforced locally here via `toggleTemplate`/`toggleMixture`, keeps at most one floating dock visible
 * at a time since the dock is always fixed bottom-center).
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
  const removeConcentration = useRemoveConcentration();
  const [createOpen, setCreateOpen] = useState(false);
  const [createKind, setCreateKind] = useState<FeedConcentrationKind>("CONCENTRATE_TEMPLATE");
  const [editId, setEditId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeedConcentrationSummary | null>(null);
  const [finalizeTarget, setFinalizeTarget] = useState<FeedConcentrationSummary | null>(null);
  const [feedTodayId, setFeedTodayId] = useState<string | null>(null);
  const bulkDeleteConcentrations = useBulkDeleteConcentrations();
  const tBulk = useTranslations("feed.bulk");

  const templates = useMemo(
    () => (concentrations.data ?? []).filter((c) => c.kind === "CONCENTRATE_TEMPLATE"),
    [concentrations.data],
  );
  const mixtures = useMemo(
    () => (concentrations.data ?? []).filter((c) => c.kind === "FEED_MIXTURE"),
    [concentrations.data],
  );

  const templateSelection = useGridBulkSelection(templates.map((c) => c.id));
  const mixtureSelection = useGridBulkSelection(mixtures.map((c) => c.id));

  /** Each section has its own independent selection, but a floating dock is always fixed
   * bottom-center — two active docks at once would overlap. Enforce mutual exclusion (selecting in
   * one section clears the other) instead of teaching the shared dock/hook about "sibling"
   * selections, which only this one caller needs. */
  function toggleTemplate(id: string) {
    if (mixtureSelection.selectedCount > 0) mixtureSelection.clear();
    templateSelection.toggle(id);
  }
  function toggleAllTemplates() {
    if (mixtureSelection.selectedCount > 0) mixtureSelection.clear();
    templateSelection.toggleAll();
  }
  function toggleMixture(id: string) {
    if (templateSelection.selectedCount > 0) templateSelection.clear();
    mixtureSelection.toggle(id);
  }
  function toggleAllMixtures() {
    if (templateSelection.selectedCount > 0) templateSelection.clear();
    mixtureSelection.toggleAll();
  }

  async function handleBulkDelete(ids: string[], onDone: () => void) {
    try {
      const result = await bulkDeleteConcentrations.mutateAsync(ids);
      toast.success(tBulk("deletedToast", { count: result.deleted }));
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tBulk("genericError"));
    }
  }

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

  return (
    <div className="flex flex-col gap-4">
      <Tabs defaultValue="ingredients">
        <TabsList className="h-auto w-full flex-wrap items-stretch justify-between gap-1 rounded-xl border border-border bg-muted p-1 text-muted-foreground">
          <TabsTrigger value="ingredients" className="flex-1">
            {t("ingredientsManager.title")}
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex-1">
            {t("concentrationTemplate")}
          </TabsTrigger>
          <TabsTrigger value="mixtures" className="flex-1">
            {t("feedMixture")}
          </TabsTrigger>
          <TabsTrigger value="requirements" className="flex-1">
            {t("requirements.tab")}
          </TabsTrigger>
        </TabsList>
        {/* RFE-103: appended, not a restructure — RAKHAL-264 owns this file's shell. */}
        <TabsContent value="requirements">
          <RequirementsTab />
        </TabsContent>
        <TabsContent value="ingredients">
          <IngredientManagementTable />
        </TabsContent>
        <TabsContent value="templates">
          <ConcentrationSection
            title={t("concentrationTemplate")}
            createLabel={t("createNewTemplate")}
            items={templates}
            isLoading={concentrations.isLoading}
            isError={concentrations.isError}
            onRetry={() => concentrations.refetch()}
            emptyDescription={t("noTemplates")}
            onSeeDetails={setDetailId}
            onCreate={() => openCreate("CONCENTRATE_TEMPLATE")}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
            onFinalize={setFinalizeTarget}
            selection={{ isSelected: templateSelection.isSelected, toggle: toggleTemplate }}
          />
        </TabsContent>
        <TabsContent value="mixtures">
          <ConcentrationSection
            title={t("feedMixture")}
            createLabel={t("createNewFeed")}
            items={mixtures}
            isLoading={concentrations.isLoading}
            isError={concentrations.isError}
            onRetry={() => concentrations.refetch()}
            emptyDescription={t("noFeeds")}
            onSeeDetails={setDetailId}
            onCreate={() => openCreate("FEED_MIXTURE")}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
            onFinalize={setFinalizeTarget}
            onFeedToday={(c) => setFeedTodayId(c.id)}
            selection={{ isSelected: mixtureSelection.isSelected, toggle: toggleMixture }}
          />
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
      <LogDistributionDialog concentrationId={feedTodayId} onOpenChange={(open) => !open && setFeedTodayId(null)} />
      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("deleteConfirmTitle")}
        description={t("deleteConfirmDescription")}
        confirmLabel={t("card.delete")}
        onConfirm={handleDeleteConfirm}
      />
      <FinalizeTmrDialog
        target={finalizeTarget}
        onOpenChange={(open) => !open && setFinalizeTarget(null)}
      />

      {/* Two dock instances, one per section — safe because each no-ops at selectedCount === 0 and
          the toggle wrappers above guarantee at most one section is ever non-empty at a time. */}
      <BulkActionDock
        selectedCount={templateSelection.selectedCount}
        totalCount={templates.length}
        onSelectAll={toggleAllTemplates}
        onCancel={templateSelection.clear}
        selectedIds={templateSelection.selectedIds}
        selectAllLabel={tBulk("selectAll", { count: templates.length })}
        cancelLabel={tBulk("cancel")}
        selectedCountLabel={tBulk("selectedCount", { count: templateSelection.selectedCount })}
        actions={[
          {
            key: "delete",
            label: tBulk("deleteSelected"),
            variant: "destructive",
            requiresConfirm: true,
            confirmTitle: tBulk("deleteConfirmTitle"),
            confirmDescription: tBulk("deleteConfirmDescription", { count: templateSelection.selectedCount }),
            confirmLabel: tBulk("deleteSelected"),
            onRun: (ids) => handleBulkDelete(ids, templateSelection.clear),
          },
        ]}
      />
      <BulkActionDock
        selectedCount={mixtureSelection.selectedCount}
        totalCount={mixtures.length}
        onSelectAll={toggleAllMixtures}
        onCancel={mixtureSelection.clear}
        selectedIds={mixtureSelection.selectedIds}
        selectAllLabel={tBulk("selectAll", { count: mixtures.length })}
        cancelLabel={tBulk("cancel")}
        selectedCountLabel={tBulk("selectedCount", { count: mixtureSelection.selectedCount })}
        actions={[
          {
            key: "delete",
            label: tBulk("deleteSelected"),
            variant: "destructive",
            requiresConfirm: true,
            confirmTitle: tBulk("deleteConfirmTitle"),
            confirmDescription: tBulk("deleteConfirmDescription", { count: mixtureSelection.selectedCount }),
            confirmLabel: tBulk("deleteSelected"),
            onRun: (ids) => handleBulkDelete(ids, mixtureSelection.clear),
          },
        ]}
      />
    </div>
  );
}
