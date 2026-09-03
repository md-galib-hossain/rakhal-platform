"use client"; // filter reads (nuqs/searchParams), row-selection state, paged query

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { RowSelectionState } from "@tanstack/react-table";
import { useSearchParams } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCan } from "@/lib/auth/permissions";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { DataTable } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { BulkActionDock } from "@/components/shared/bulk-action-dock";
import { CreatableSelect } from "@/components/shared/creatable-select";
import { useTableBulkSelection, useGridBulkSelection } from "@/lib/hooks/use-bulk-selection";
import { useCattleDetailModal } from "../context/cattle-detail-modal-context";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useBulkCattle,
  useCattlePagedList,
  useCreateFeedGroupInline,
  useCreateShedInline,
  useFeedGroups,
  useSheds,
} from "../hooks/use-cattle";
import { buildCattleColumns } from "./cattle-columns";
import { CattleGrid } from "./cattle-grid";
import type {
  AnimalCategory,
  BulkDisposeType,
  CattleListFilters,
  CattleListItem,
  CattleStatus,
  HealthStatusFilter,
  LifecycleSubStage,
  ProductionStatus,
  ReproductiveStatus,
} from "../types";

/** Reads the URL params `CattleFilters` writes (both are siblings under the same page) and drives
 * the cursor-paginated table + bulk-selection dock. Bulk-action logic (change shed/feed-group,
 * dispose, export) used to live in a separate `CattleBulkActionsBar` rendered inline above the
 * table; folded in directly here (2026-07-21, migration to the shared floating `BulkActionDock` —
 * same pattern `MedicineView`/`EquipmentView`/etc. already use) since a portal-rendered dock has no
 * reason to be wrapped in its own component once there's no inline DOM slot to own.
 *
 * The dock's bulk action used to be a single "Mark as sold" button (`mark_sold`); replaced by a
 * "Dispose" button opening a type picker (Sold/Culled/Deceased) so one dock action covers all 3
 * lifecycle exits, matching the single-row `CattleDisposeDialog` for consistency (UX request, no
 * ticket #). Row-level edit/dispose/delete/restore moved into `CattleDetailSheet` at the same time —
 * the old per-row 3-dot menu duplicated the "View Details" entry point this sheet already is. */
export function CattleTable() {
  const t = useTranslations("cattle");
  const can = useCan();
  const canBulk = can("cattle.bulk");
  const searchParams = useSearchParams();
  const { openCattleDetail } = useCattleDetailModal();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [shedDialogOpen, setShedDialogOpen] = useState(false);
  const [feedGroupDialogOpen, setFeedGroupDialogOpen] = useState(false);
  const [shedId, setShedId] = useState<string | undefined>(undefined);
  const [feedGroupId, setFeedGroupId] = useState<string | undefined>(undefined);
  /** RAKHAL-042's "cards (mobile default)" AC — seeded from viewport width on mount (SSR-safe
   * `useMediaQuery`, starts `false`/table so it never fights hydration), then a manual toggle
   * (same `LayoutGrid`/`List` pair `InventoryTabs` already uses) lets either device switch freely
   * afterward. Not URL-synced like `?view=` above — that param is the detail-drawer deep link,
   * unrelated to this list/grid presentation toggle. */
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [listMode, setListMode] = useState<"table" | "grid" | null>(null);
  const mode = listMode ?? (isMobile ? "grid" : "table");

  const filters: CattleListFilters = {
    search: searchParams.get("search") ?? undefined,
    breedId: searchParams.get("breedId") ?? undefined,
    shedId: searchParams.get("shedId") ?? undefined,
    feedGroupId: searchParams.get("feedGroupId") ?? undefined,
    productionStatus: (searchParams.get("productionStatus") as ProductionStatus | null) ?? undefined,
    healthStatus: (searchParams.get("healthStatus") as HealthStatusFilter | null) ?? undefined,
    reproductiveStatus: (searchParams.get("reproductiveStatus") as ReproductiveStatus | null) ?? undefined,
    animalCategory: (searchParams.get("animalCategory") as AnimalCategory | null) ?? undefined,
    status: (searchParams.get("herdStatus") as CattleStatus | null) ?? undefined,
    lifecycleSubStage: (searchParams.get("lifecycleSubStage") as LifecycleSubStage | null) ?? undefined,
  };

  const query = useCattlePagedList(filters);
  const bulk = useBulkCattle();
  const sheds = useSheds();
  const feedGroups = useFeedGroups();
  const createShedInline = useCreateShedInline();
  const createFeedGroupInline = useCreateFeedGroupInline();
  const items = query.items;
  const [disposeDialogOpen, setDisposeDialogOpen] = useState(false);
  const [disposeType, setDisposeType] = useState<BulkDisposeType>("SALE");
  const columns = useMemo(
    () =>
      buildCattleColumns(t, {
        onView: (cattle) => openCattleDetail(cattle.id),
      }),
    [t, openCattleDetail],
  );

  const allIds = items.map((c) => c.id);
  const tableSelection = useTableBulkSelection(rowSelection, setRowSelection, allIds);
  const gridSelection = useGridBulkSelection(allIds);
  const selection = mode === "table" ? tableSelection : gridSelection;
  const selectedItems = items.filter((c) => selection.selectedIds.includes(c.id));
  const tBulk = useTranslations("cattle.bulk");

  async function run(
    action: "change_shed" | "change_feed_group" | "dispose",
    payload?: { shedId?: string; feedGroupId?: string; type?: BulkDisposeType; reason?: string; date?: string },
  ) {
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
      c.productionStatus ?? "",
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
      <div className="ml-auto flex w-fit items-center gap-0.5 rounded-lg bg-muted p-0.5">
        <button
          type="button"
          onClick={() => setListMode("grid")}
          aria-label={t("view.gridView")}
          aria-pressed={mode === "grid"}
          className={cn(
            "flex size-[30px] items-center justify-center rounded-md transition-colors",
            mode === "grid" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <LayoutGrid className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setListMode("table")}
          aria-label={t("view.tableView")}
          aria-pressed={mode === "table"}
          className={cn(
            "flex size-[30px] items-center justify-center rounded-md transition-colors",
            mode === "table" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <List className="size-4" aria-hidden />
        </button>
      </div>

      {mode === "table" ? (
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
      ) : (
        <CattleGrid
          items={items}
          isLoading={query.isLoading}
          isError={query.isError}
          onRetry={() => query.refetch()}
          rowActions={{
            onView: (cattle) => openCattleDetail(cattle.id),
          }}
          canSelect={canBulk}
          isSelected={gridSelection.isSelected}
          onToggleSelect={gridSelection.toggle}
        />
      )}
      <Pagination
        page={query.page}
        totalPages={query.totalPages}
        onPageChange={(page) => {
          query.goToPage(page);
          setRowSelection({});
        }}
        isFetching={query.isFetching}
        pageSize={query.pageSize}
        onPageSizeChange={(size) => {
          query.setPageSize(size);
          setRowSelection({});
        }}
      />

      <Sheet open={shedDialogOpen} onOpenChange={setShedDialogOpen}>
        <SheetContent side="right" className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{tBulk("changeShed")}</SheetTitle>
            <SheetDescription>{tBulk("changeShedDescription", { count: selection.selectedCount })}</SheetDescription>
          </SheetHeader>
          <CreatableSelect
            value={shedId}
            onValueChange={setShedId}
            options={sheds.data?.items ?? []}
            trigger={
              <SelectTrigger aria-label={tBulk("shedLabel")}>
                <SelectValue placeholder={tBulk("shedLabel")} />
              </SelectTrigger>
            }
            createLabel={t("form.addShed")}
            namePlaceholder={t("form.shedNamePlaceholder")}
            createErrorMessage={t("form.addShedError")}
            onCreate={(name) => createShedInline.mutateAsync(name)}
          />
          <SheetFooter className="border-t border-dashed border-border pt-4">
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
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={feedGroupDialogOpen} onOpenChange={setFeedGroupDialogOpen}>
        <SheetContent side="right" className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{tBulk("changeFeedGroup")}</SheetTitle>
            <SheetDescription>{tBulk("changeFeedGroupDescription", { count: selection.selectedCount })}</SheetDescription>
          </SheetHeader>
          <CreatableSelect
            value={feedGroupId}
            onValueChange={setFeedGroupId}
            options={feedGroups.data ?? []}
            trigger={
              <SelectTrigger aria-label={tBulk("feedGroupLabel")}>
                <SelectValue placeholder={tBulk("feedGroupLabel")} />
              </SelectTrigger>
            }
            createLabel={t("form.addFeedGroup")}
            namePlaceholder={t("form.feedGroupNamePlaceholder")}
            createErrorMessage={t("form.addFeedGroupError")}
            onCreate={(name) => createFeedGroupInline.mutateAsync(name)}
          />
          <SheetFooter className="border-t border-dashed border-border pt-4">
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
          </SheetFooter>
        </SheetContent>
      </Sheet>

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
            key: "dispose",
            label: tBulk("dispose"),
            variant: "destructive",
            onRun: () => setDisposeDialogOpen(true),
          },
          { key: "export", label: tBulk("export"), variant: "outline", onRun: exportCsv },
        ]}
      />

      <Sheet open={disposeDialogOpen} onOpenChange={setDisposeDialogOpen}>
        <SheetContent side="right" className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{tBulk("dispose")}</SheetTitle>
            <SheetDescription>{tBulk("disposeDescription", { count: selection.selectedCount })}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-1.5">
            <Label>{tBulk("disposeTypeLabel")}</Label>
            <Select value={disposeType} onValueChange={(v) => setDisposeType(v as BulkDisposeType)}>
              <SelectTrigger aria-label={tBulk("disposeTypeLabel")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SALE">{tBulk("disposeTypeOptions.SALE")}</SelectItem>
                <SelectItem value="CULL">{tBulk("disposeTypeOptions.CULL")}</SelectItem>
                <SelectItem value="DEATH">{tBulk("disposeTypeOptions.DEATH")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SheetFooter className="border-t border-dashed border-border pt-4">
            <Button variant="outline" onClick={() => setDisposeDialogOpen(false)}>
              {tBulk("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={bulk.isPending}
              onClick={async () => {
                await run("dispose", { type: disposeType });
                setDisposeDialogOpen(false);
              }}
            >
              {tBulk("apply")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
