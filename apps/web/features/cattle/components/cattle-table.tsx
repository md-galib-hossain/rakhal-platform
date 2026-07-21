"use client"; // filter reads (nuqs/searchParams), row-selection state, paged query

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { RowSelectionState } from "@tanstack/react-table";
import { useSearchParams } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { cn } from "@/lib/utils";
import { useCan } from "@/lib/auth/permissions";
import { DataTable } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { BulkActionDock } from "@/components/shared/bulk-action-dock";
import { useTableBulkSelection } from "@/lib/hooks/use-bulk-selection";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBulkCattle, useCattleDetail, useCattlePagedList, useFeedGroups, useSheds } from "../hooks/use-cattle";
import { buildCattleColumns } from "./cattle-columns";
import { CattleFormDialog } from "./cattle-form-dialog";
import { CattleStatusDialog } from "./cattle-status-dialog";
import { CattleArchiveDialog } from "./cattle-archive-dialog";
import { CattleDetailSheet } from "./detail/cattle-detail-sheet";
import type { CattleListFilters, CattleListItem, HealthStatusFilter, ProductionStatus } from "../types";

/** Reads the URL params `CattleFilters` writes (both are siblings under the same page) and drives
 * the cursor-paginated table + bulk-selection dock. Bulk-action logic (change shed/feed-group,
 * mark sold, export) used to live in a separate `CattleBulkActionsBar` rendered inline above the
 * table; folded in directly here (2026-07-21, migration to the shared floating `BulkActionDock` —
 * same pattern `MedicineView`/`EquipmentView`/etc. already use) since a portal-rendered dock has no
 * reason to be wrapped in its own component once there's no inline DOM slot to own. */
export function CattleTable() {
  const t = useTranslations("cattle");
  const can = useCan();
  const canBulk = can("cattle.bulk");
  const searchParams = useSearchParams();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [formOpen, setFormOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<CattleListItem | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<CattleListItem | null>(null);
  const [shedDialogOpen, setShedDialogOpen] = useState(false);
  const [feedGroupDialogOpen, setFeedGroupDialogOpen] = useState(false);
  const [shedId, setShedId] = useState<string | undefined>(undefined);
  const [feedGroupId, setFeedGroupId] = useState<string | undefined>(undefined);
  /** URL-synced (`?view=`) rather than local state — the drawer is the *only* cattle detail view
   * now (no standalone `/cattle/:id` page), so its own deep link has to live here for the redirect
   * in `app/(app)/cattle/[id]/page.tsx` to have somewhere to land. */
  const [viewId, setViewId] = useQueryState("view", parseAsString);

  const filters: CattleListFilters = {
    search: searchParams.get("search") ?? undefined,
    breedId: searchParams.get("breedId") ?? undefined,
    shedId: searchParams.get("shedId") ?? undefined,
    feedGroupId: searchParams.get("feedGroupId") ?? undefined,
    productionStatus: (searchParams.get("productionStatus") as ProductionStatus | null) ?? undefined,
    healthStatus: (searchParams.get("healthStatus") as HealthStatusFilter | null) ?? undefined,
  };

  const query = useCattlePagedList(filters);
  const editingDetail = useCattleDetail(editingId);
  const bulk = useBulkCattle();
  const sheds = useSheds();
  const feedGroups = useFeedGroups();
  const items = query.items;
  const columns = useMemo(
    () =>
      buildCattleColumns(t, {
        onView: (cattle) => void setViewId(cattle.id),
        onEdit: (cattle) => {
          setEditingId(cattle.id);
          setFormOpen(true);
        },
        onChangeStatus: setStatusTarget,
        onArchive: setArchiveTarget,
      }),
    [t, setViewId],
  );

  const allIds = items.map((c) => c.id);
  const selection = useTableBulkSelection(rowSelection, setRowSelection, allIds);
  const selectedItems = items.filter((c) => selection.selectedIds.includes(c.id));
  const tBulk = useTranslations("cattle.bulk");

  async function run(action: "change_shed" | "change_feed_group" | "mark_sold", payload?: { shedId?: string; feedGroupId?: string }) {
    try {
      const result = await bulk.mutateAsync({ cattleIds: selection.selectedIds, action, payload });
      toast.success(tBulk("resultToast", { updated: result.updated, failed: result.failed }));
      selection.clear();
    } catch {
      toast.error(tBulk("failedToast"));
    }
  }

  function exportCsv() {
    const header = ["name", "tagNumber", "breed", "shed", "productionStatus", "healthStatus", "aqrScore"];
    const rows = selectedItems.map((c) => [
      c.name ?? "",
      c.tagNumber,
      c.breed?.name ?? "",
      c.shed?.name ?? "",
      c.productionStatus,
      c.healthStatus,
      c.aqrScore ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cattle-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-border",
          // Figma "Cattle" table spec, scoped to this instance only (not the shared `Table`
          // primitive, which every other page's table also uses): 54px normal-case header row,
          // 56px body rows (achieved by trimming `TableCell`'s default py-3 to py-2).
          "[&_thead_tr]:border-b-0 [&_thead_tr]:bg-muted",
          "[&_thead_th]:h-[54px] [&_thead_th]:text-sm [&_thead_th]:font-medium [&_thead_th]:normal-case [&_thead_th]:tracking-normal [&_thead_th]:text-muted-foreground",
          "[&_tbody_td]:py-2",
        )}
      >
        <DataTable
          columns={columns}
          data={items}
          getRowId={(row) => row.id}
          isLoading={query.isLoading}
          isError={query.isError}
          onRetry={() => query.refetch()}
          emptyState={{ title: t("empty.title"), description: t("empty.description") }}
          enableRowSelection={canBulk}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
        />
      </div>
      <Pagination
        page={query.page}
        totalPages={query.totalPages}
        onPageChange={(page) => {
          query.goToPage(page);
          setRowSelection({});
        }}
        disabled={query.isFetching}
      />

      <CattleDetailSheet
        cattleId={viewId ?? undefined}
        onOpenChange={(open) => !open && void setViewId(null)}
        onEdit={(cattle) => {
          void setViewId(null);
          setEditingId(cattle.id);
          setFormOpen(true);
        }}
      />
      <CattleFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingId(undefined);
        }}
        cattle={editingDetail.data}
      />
      <CattleStatusDialog
        open={statusTarget !== null}
        onOpenChange={(open) => !open && setStatusTarget(null)}
        cattle={statusTarget}
      />
      <CattleArchiveDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
        cattle={archiveTarget}
      />

      <Dialog open={shedDialogOpen} onOpenChange={setShedDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tBulk("changeShed")}</DialogTitle>
            <DialogDescription>{tBulk("changeShedDescription", { count: selection.selectedCount })}</DialogDescription>
          </DialogHeader>
          <Select value={shedId} onValueChange={setShedId}>
            <SelectTrigger aria-label={tBulk("shedLabel")}>
              <SelectValue placeholder={tBulk("shedLabel")} />
            </SelectTrigger>
            <SelectContent>
              {(sheds.data?.items ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShedDialogOpen(false)}>
              {tBulk("cancel")}
            </Button>
            <Button
              disabled={!shedId || bulk.isPending}
              onClick={async () => {
                await run("change_shed", { shedId });
                setShedDialogOpen(false);
                setShedId(undefined);
              }}
            >
              {tBulk("apply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={feedGroupDialogOpen} onOpenChange={setFeedGroupDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tBulk("changeFeedGroup")}</DialogTitle>
            <DialogDescription>{tBulk("changeFeedGroupDescription", { count: selection.selectedCount })}</DialogDescription>
          </DialogHeader>
          <Select value={feedGroupId} onValueChange={setFeedGroupId}>
            <SelectTrigger aria-label={tBulk("feedGroupLabel")}>
              <SelectValue placeholder={tBulk("feedGroupLabel")} />
            </SelectTrigger>
            <SelectContent>
              {(feedGroups.data ?? []).map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedGroupDialogOpen(false)}>
              {tBulk("cancel")}
            </Button>
            <Button
              disabled={bulk.isPending}
              onClick={async () => {
                await run("change_feed_group", { feedGroupId });
                setFeedGroupDialogOpen(false);
                setFeedGroupId(undefined);
              }}
            >
              {tBulk("apply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkActionDock
        selectedCount={selection.selectedCount}
        totalCount={allIds.length}
        onSelectAll={selection.toggleAll}
        onCancel={selection.clear}
        selectedIds={selection.selectedIds}
        selectAllLabel={tBulk("selectAll", { count: allIds.length })}
        cancelLabel={tBulk("cancel")}
        selectedCountLabel={tBulk("selectedCount", { count: selection.selectedCount })}
        actions={[
          { key: "change_shed", label: tBulk("changeShed"), variant: "outline", onRun: () => setShedDialogOpen(true) },
          { key: "change_feed_group", label: tBulk("changeFeedGroup"), variant: "outline", onRun: () => setFeedGroupDialogOpen(true) },
          {
            key: "mark_sold",
            label: tBulk("markSold"),
            variant: "destructive",
            requiresConfirm: true,
            confirmTitle: tBulk("markSold"),
            confirmDescription: tBulk("markSoldDescription", { count: selection.selectedCount }),
            confirmLabel: tBulk("markSold"),
            onRun: () => run("mark_sold"),
          },
          { key: "export", label: tBulk("export"), variant: "outline", onRun: exportCsv },
        ]}
      />
    </div>
  );
}
