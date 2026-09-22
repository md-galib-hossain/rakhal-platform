"use client"; // date/group filter state + per-cow draft quantities + bulk-assign source item + save/confirm mutations

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Clock,
  History,
  Layers,
  Package,
  Plus,
  Scale,
  Wheat,
  X,
} from "lucide-react";
import { FeedingCowHistorySheet } from "./feeding-cow-history-sheet";
import { Pagination } from "@/components/shared/pagination";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { EntryStatusDatePicker } from "@/components/shared/entry-status-date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { AnimalLink } from "@/components/shared/animal-link";
import { Can } from "@/lib/auth/permissions";
import { useGridBulkSelection } from "@/lib/hooks/use-bulk-selection";
import { useFeedItemDetail, useFeedItemPagedList } from "@/features/inventory/hooks/use-inventory";
import { FeedItemFormDialog } from "@/features/inventory/components/feed-item-form-dialog";
import { CreateFeedDialog } from "../../feed/components/create-feed-dialog";
import {
  useConcentrations,
  useFeedActiveSessions,
  useFeedGroups,
  useFeedGrid,
  useFeedGridCalendar,
  useConfirmFeedDraft,
  useSaveFeedDraft,
  useFeedStock,
} from "../../feed/hooks/use-feed";
import type { FeedGridCow, FeedGridEntryInput, FeedGridSource, FeedGridSourceType } from "../../feed/types";

interface FeedSourceOption {
  id: string;
  label: string;
  stockAmount?: number;
  stockUnit?: string;
}

/** One cow row's own resolved source — `null` means "unresolved, must pick before this row can be
 * saved/confirmed." Mirrors `FeedGridSource` but with a single `itemId` instead of two nullable id
 * columns, matching the toolbar's own `{sourceType, itemId}` shape. */
interface RowSource {
  sourceType: FeedGridSourceType;
  itemId: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const ALL_GROUPS = "__all__";
const DEFAULT_PAGE_SIZE = 20;

/** Sums a cow's already-saved (not yet confirmed) draft lines for this date/group — the value shown
 * when the grid is reopened on a date that already has staged entries. Falls back to the backend's
 * own carry-forward `default_offered_kg` when nothing is staged yet — which is `null`, not `0`,
 * whenever the cow has no prior confirmed feeding to carry forward (confirmed live against the real
 * dev stack), so that case renders as an empty, must-fill cell rather than a misleading "0". */
function initialQuantity(cow: FeedGridCow): string {
  if (cow.drafts.length > 0) return String(cow.drafts.reduce((sum, d) => sum + d.offered_kg, 0));
  return cow.default_offered_kg == null ? "" : String(cow.default_offered_kg);
}

function buildInitialQuantities(cows: FeedGridCow[]): Record<string, string> {
  const drafts: Record<string, string> = {};
  for (const cow of cows) {
    drafts[cow.cattle_id] = initialQuantity(cow);
  }
  return drafts;
}

/** Pre-checks any cow that already has a staged draft for this date — re-opening the grid shows
 * exactly what was left staged, not an empty selection. */
function buildInitialSelection(cows: FeedGridCow[]): string[] {
  return cows.filter((c) => c.drafts.length > 0).map((c) => c.cattle_id);
}

/** A cow with no draft for this date shows `default_offered_kg` — yesterday's carried-forward
 * amount, not anything entered for today — in the same quantity cell. */
function buildInitialCarriedOver(cows: FeedGridCow[]): Record<string, boolean> {
  const carried: Record<string, boolean> = {};
  for (const cow of cows) carried[cow.cattle_id] = cow.drafts.length === 0 && cow.default_offered_kg != null;
  return carried;
}

function toRowSource(source: FeedGridSource): RowSource | null {
  const itemId = source.source_type === "FEED_ITEM" ? source.feed_item_id : source.feed_stock_id;
  return itemId ? { sourceType: source.source_type, itemId } : null;
}

/** RFE-115: each cow's own pre-filled source — its own already-staged draft's source (RAKHAL-430
 * onward, a draft can carry its own source) if one exists, else the resolution ladder's
 * `default_source` (RAKHAL-431: own last-used → feed-group default → none), else unresolved. */
function initialRowSource(cow: FeedGridCow): RowSource | null {
  const draft = cow.drafts[0];
  if (draft) {
    const itemId = draft.source_type === "FEED_ITEM" ? draft.feed_item_id : draft.feed_stock_id;
    if (itemId) return { sourceType: draft.source_type, itemId };
  }
  return cow.default_source ? toRowSource(cow.default_source) : null;
}

function buildInitialSources(cows: FeedGridCow[]): Record<string, RowSource | null> {
  const sources: Record<string, RowSource | null> = {};
  for (const cow of cows) sources[cow.cattle_id] = initialRowSource(cow);
  return sources;
}

function initialSource(cows: FeedGridCow[]): { sourceType: FeedGridSourceType; itemId: string } {
  for (const cow of cows) {
    const draft = cow.drafts[0];
    if (draft) {
      return {
        sourceType: draft.source_type,
        itemId: (draft.source_type === "FEED_ITEM" ? draft.feed_item_id : draft.feed_stock_id) ?? "",
      };
    }
  }
  return { sourceType: "FEED_ITEM", itemId: "" };
}

/**
 * "Feeding Grid" — per-day, per-cow feed entry. `FeedingGridTable` is remounted via `key={date}`
 * so its local draft/selection state always re-seeds fresh from that day's `GET /feed/grid` response.
 */
export function FeedingGrid() {
  const t = useTranslations("feeding.grid");
  const [date, setDate] = useState(todayIso());
  const [feedGroupId, setFeedGroupId] = useState(ALL_GROUPS);
  const [calendarMonth, setCalendarMonth] = useState(todayIso().slice(0, 7));
  const groupFilter = feedGroupId === ALL_GROUPS ? undefined : feedGroupId;
  const query = useFeedGrid(date, groupFilter);
  const feedGroups = useFeedGroups();
  const calendarQuery = useFeedGridCalendar(calendarMonth);

  const cows = query.data?.cows ?? [];

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-card p-4 sm:p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Wheat className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>
            <p className="text-xs text-muted-foreground">{t("bulkToolbar.subtitle")}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Select value={feedGroupId} onValueChange={setFeedGroupId}>
            <SelectTrigger className="w-[170px]" aria-label={t("groupFilterLabel")}>
              <SelectValue placeholder={t("groupFilter")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_GROUPS}>{t("groupFilter")}</SelectItem>
              {(feedGroups.data ?? []).map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="w-[170px] shrink-0">
            <EntryStatusDatePicker
              label={t("dateLabel")}
              value={date}
              onChange={setDate}
              onMonthChange={setCalendarMonth}
              days={calendarQuery.data?.days ?? []}
              disabledDates={{ after: new Date() }}
            />
          </div>
        </div>
      </div>

      {query.isLoading ? (
        <CardSkeleton lines={6} />
      ) : query.isError ? (
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      ) : (
        <FeedingGridTable key={`${date}:${groupFilter ?? ""}`} date={date} feedGroupId={groupFilter} cows={cows} />
      )}
    </div>
  );
}

function FeedingGridTable({
  date,
  feedGroupId,
  cows,
}: {
  date: string;
  feedGroupId: string | undefined;
  cows: FeedGridCow[];
}) {
  const t = useTranslations("feeding.grid");
  const saveDraft = useSaveFeedDraft();
  const confirmDraft = useConfirmFeedDraft();
  const [itemSearch, setItemSearch] = useState("");
  const feedItems = useFeedItemPagedList({ search: itemSearch || undefined });
  const feedStock = useFeedStock();
  const concentrations = useConcentrations();

  const activeSessions = useFeedActiveSessions();
  const [session, setSession] = useState<string>("");
  const [historyCow, setHistoryCow] = useState<{ id: string; name: string | null } | null>(null);

  const [quantities, setQuantities] = useState<Record<string, string>>(() => buildInitialQuantities(cows));
  const [carriedOver, setCarriedOver] = useState<Record<string, boolean>>(() => buildInitialCarriedOver(cows));
  const [sources, setSources] = useState<Record<string, RowSource | null>>(() => buildInitialSources(cows));
  const selection = useGridBulkSelection(
    cows.map((c) => c.cattle_id),
    buildInitialSelection(cows),
  );

  const initialSourceValue = useMemo(() => initialSource(cows), [cows]);
  const [sourceType, setSourceType] = useState<FeedGridSourceType>(initialSourceValue.sourceType);
  const [itemId, setItemId] = useState(initialSourceValue.itemId);
  const [sharedKg, setSharedKg] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"save" | "confirm" | null>(null);
  const [addFeedItemOpen, setAddFeedItemOpen] = useState(false);
  const [createKind, setCreateKind] = useState<"CONCENTRATE_TEMPLATE" | "FEED_MIXTURE">("CONCENTRATE_TEMPLATE");
  const [createOpen, setCreateOpen] = useState(false);
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(cows.length / pageSize));
  const pageRows = cows.slice((page - 1) * pageSize, page * pageSize);

  const feedItemOptions: FeedSourceOption[] = useMemo(
    () =>
      feedItems.items.map((item) => ({
        id: item.id,
        label: `${item.name} (${item.currentStock} ${item.unit.symbol})`,
        stockAmount: item.currentStock,
        stockUnit: item.unit.symbol,
      })),
    [feedItems.items],
  );

  const stockOptions: FeedSourceOption[] = useMemo(
    () =>
      (feedStock.data ?? []).map((s) => ({
        id: s.id,
        label: `${concentrations.data?.find((c) => c.id === s.source_concentration_id)?.name ?? t("unknownStock")} (${s.current_stock_kg} kg)`,
        stockAmount: s.current_stock_kg,
        stockUnit: "kg",
      })),
    [feedStock.data, concentrations.data, t],
  );

  const sourceOptions = sourceType === "FEED_ITEM" ? feedItemOptions : stockOptions;
  const filteredSourceOptions = useMemo(
    () =>
      sourceType === "FEED_ITEM"
        ? sourceOptions
        : sourceOptions.filter((opt) => opt.label.toLowerCase().includes(itemSearch.toLowerCase())),
    [sourceType, sourceOptions, itemSearch],
  );
  const selectedSourceOption = sourceOptions.find((opt) => opt.id === itemId);
  const selectedItemDetail = useFeedItemDetail(
    sourceType === "FEED_ITEM" && itemId ? itemId : undefined,
  );
  const selectedSourceLabel =
    selectedSourceOption?.label ??
    (sourceType === "FEED_ITEM" && selectedItemDetail.data
      ? `${selectedItemDetail.data.name} (${selectedItemDetail.data.currentStock} ${selectedItemDetail.data.unit.symbol})`
      : undefined);

  function handleApplyUnified() {
    if (selection.selectedIds.length === 0) return;
    const count = selection.selectedIds.length;
    const hasSource = Boolean(itemId);
    const kg = Number(sharedKg);
    const hasKg = Number.isFinite(kg) && kg >= 0 && sharedKg.trim() !== "";

    if (!hasSource && !hasKg) return;

    if (hasSource) {
      setSources((prev) => {
        const next = { ...prev };
        for (const id of selection.selectedIds) next[id] = { sourceType, itemId };
        return next;
      });
    }

    if (hasKg) {
      setQuantities((prev) => {
        const next = { ...prev };
        for (const id of selection.selectedIds) next[id] = String(kg);
        return next;
      });
      setCarriedOver((prev) => {
        const next = { ...prev };
        for (const id of selection.selectedIds) next[id] = false;
        return next;
      });
    }

    if (hasSource && hasKg) {
      toast.success(t("bulkToolbar.appliedBothToast", { count, kg }));
    } else if (hasSource) {
      toast.success(t("applySourceToSelected", { count }));
    } else if (hasKg) {
      toast.success(t("applyToSelected", { count }));
    }
  }

  function buildEntries(): FeedGridEntryInput[] {
    return selection.selectedIds
      .map((cattleId) => {
        const offeredKg = Number(quantities[cattleId]);
        const source = sources[cattleId];
        return { cattleId, offeredKg, source };
      })
      .filter(
        (e): e is { cattleId: string; offeredKg: number; source: RowSource } =>
          Number.isFinite(e.offeredKg) && e.offeredKg > 0 && e.source !== null,
      )
      .map(({ cattleId, offeredKg, source }) => ({
        cattleId,
        offeredKg,
        sourceType: source.sourceType,
        feedItemId: source.sourceType === "FEED_ITEM" ? source.itemId : undefined,
        feedStockId: source.sourceType === "FEED_STOCK" ? source.itemId : undefined,
      }));
  }

  const canSubmit = selection.selectedIds.length > 0;

  function topLevelSource() {
    if (!itemId) return {};
    return {
      sourceType,
      feedItemId: sourceType === "FEED_ITEM" ? itemId : undefined,
      feedStockId: sourceType === "FEED_STOCK" ? itemId : undefined,
    };
  }

  async function runSave() {
    const entries = buildEntries();
    if (entries.length === 0) {
      toast.error(t("noEntries"));
      return;
    }
    try {
      const result = await saveDraft.mutateAsync({
        date,
        feedGroupId,
        ...topLevelSource(),
        entries,
      });
      toast.success(t("savedToast", { count: result.saved }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  async function runConfirm() {
    const entries = buildEntries();
    try {
      const result = await confirmDraft.mutateAsync({
        date,
        feedGroupId,
        ...topLevelSource(),
        entries: entries.length > 0 ? entries : undefined,
        session: session || undefined,
      });
      toast.success(t("confirmedToast", { count: result.cows.length }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  async function handleSave() {
    if (!canSubmit) return;
    setPendingAction("save");
    try {
      await runSave();
    } finally {
      setPendingAction(null);
    }
  }

  function handleConfirmClick() {
    if (!canSubmit) return;
    setConfirmOpen(true);
  }

  async function handleConfirmDialog() {
    setPendingAction("confirm");
    await runConfirm();
    setPendingAction(null);
  }

  const isPending = saveDraft.isPending || confirmDraft.isPending;

  // Live total sum calculation for selected cows
  const totalSelectedOfferedKg = useMemo(() => {
    return selection.selectedIds.reduce((sum, id) => {
      const val = Number(quantities[id]);
      return sum + (Number.isFinite(val) && val > 0 ? val : 0);
    }, 0);
  }, [selection.selectedIds, quantities]);

  return (
    <>
      {/* Bulk Action Toolbar */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border/80 bg-muted/40 p-3 shadow-xs">
        {/* Feed Source Selection */}
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Layers className="size-3.5" />
            {t("bulkToolbar.sourceSection")}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-11 rounded-md border border-border bg-card p-1 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  setSourceType("FEED_ITEM");
                  setItemId("");
                  setItemSearch("");
                }}
                className={cn(
                  "flex h-full items-center gap-1.5 rounded-md px-3.5 text-sm font-medium transition-colors",
                  sourceType === "FEED_ITEM"
                    ? "bg-primary text-white shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Package className="size-4" />
                {t("bulkToolbar.sourceTypePurchased")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSourceType("FEED_STOCK");
                  setItemId("");
                  setItemSearch("");
                }}
                className={cn(
                  "flex h-full items-center gap-1.5 rounded-md px-3.5 text-sm font-medium transition-colors",
                  sourceType === "FEED_STOCK"
                    ? "bg-primary text-white shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Wheat className="size-4" />
                {t("bulkToolbar.sourceTypePrepared")}
              </button>
            </div>

            <Popover
              open={itemPickerOpen}
              onOpenChange={(next) => {
                setItemPickerOpen(next);
                if (!next) setItemSearch("");
              }}
              modal={false}
            >
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={itemPickerOpen}
                  aria-label={t("itemLabel")}
                  className={cn(
                    "w-56 sm:w-64 justify-between bg-card font-normal shadow-2xs text-left",
                    !selectedSourceLabel && "text-muted-foreground",
                  )}
                >
                  <span className="truncate">{selectedSourceLabel ?? t("itemPlaceholder")}</span>
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" aria-hidden />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 sm:w-80 p-0 shadow-lg" align="start">
                <Command shouldFilter={false}>
                  <CommandInput placeholder={t("searchItemPlaceholder")} value={itemSearch} onValueChange={setItemSearch} />
                  <CommandList className="max-h-60">
                    <CommandEmpty>{t("noItemsFound")}</CommandEmpty>
                    <CommandGroup heading={sourceType === "FEED_ITEM" ? t("rowSource.purchasedGroup") : t("rowSource.preparedGroup")}>
                      {filteredSourceOptions.map((opt) => (
                        <CommandItem
                          key={opt.id}
                          value={opt.id}
                          onSelect={() => {
                            setItemId(opt.id);
                            setItemPickerOpen(false);
                          }}
                          className="flex items-center gap-2 cursor-pointer py-2"
                        >
                          <Check className={cn("size-4 text-primary shrink-0", opt.id === itemId ? "opacity-100" : "opacity-0")} aria-hidden />
                          <span className="truncate">{opt.label}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
                <div className="flex flex-col border-t border-border p-1 bg-muted/20">
                  {sourceType === "FEED_ITEM" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setItemPickerOpen(false);
                        setAddFeedItemOpen(true);
                      }}
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-muted"
                    >
                      <Plus className="size-3.5" aria-hidden /> {t("addFeedItem")}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setItemPickerOpen(false);
                          setCreateKind("CONCENTRATE_TEMPLATE");
                          setCreateOpen(true);
                        }}
                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-muted"
                      >
                        <Plus className="size-3.5" aria-hidden /> {t("createConcentrate")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setItemPickerOpen(false);
                          setCreateKind("FEED_MIXTURE");
                          setCreateOpen(true);
                        }}
                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-muted"
                      >
                        <Plus className="size-3.5" aria-hidden /> {t("createTmr")}
                      </button>
                    </>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

          {/* RAKHAL-441 frontend twin: session tag (Morning/Noon/Evening/Night), applied at
              Confirm time only — the farm's own configured sessions, same list Milk uses. */}
          {(activeSessions.data ?? []).length > 0 ? (
            <div className="flex w-40 flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Clock className="size-3.5" />
                {t("bulkToolbar.sessionSection")}
              </span>
              <Select value={session || undefined} onValueChange={setSession}>
                <SelectTrigger className="h-11 bg-card shadow-2xs" aria-label={t("bulkToolbar.sessionSection")}>
                  <SelectValue placeholder={t("bulkToolbar.sessionPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {(activeSessions.data ?? []).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {/* Quantity per Head */}
          <div className="flex w-44 flex-col gap-1.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Scale className="size-3.5" />
              {t("bulkToolbar.quantitySection")}
            </span>
            <div className="flex h-11 items-center gap-2 rounded-md border border-input bg-card px-3.5 text-sm shadow-2xs focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary">
              <Input
                type="number"
                min={0}
                step={0.1}
                placeholder={t("kgPerHeadPlaceholder")}
                className="h-auto w-full border-none p-0 text-sm font-medium shadow-none focus-visible:ring-0"
                value={sharedKg}
                onChange={(e) => setSharedKg(e.target.value)}
              />
              <span className="shrink-0 text-xs font-semibold text-muted-foreground">kg</span>
            </div>
          </div>

          {/* Step 3: Single Unified Apply Button */}
          <div className="flex flex-col gap-1.5">
            <span className="hidden select-none text-xs font-semibold text-transparent sm:block">Action</span>
            <Button
              variant="primary"
              className="gap-2 font-semibold shadow-2xs px-5"
              disabled={selection.selectedIds.length === 0 || (!itemId && !sharedKg)}
              onClick={handleApplyUnified}
            >
              <ArrowRight className="size-4" />
              {t("bulkToolbar.applyUnified", { count: selection.selectedIds.length })}
            </Button>
          </div>
        </div>

      {/* Main Data Table */}
      {cows.length === 0 ? (
        <EmptyState title={t("noCattle")} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border shadow-xs bg-card">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12 text-center">
                  <Checkbox
                    checked={selection.isAllSelected}
                    onCheckedChange={() => selection.toggleAll()}
                    aria-label={t("selectAll")}
                  />
                </TableHead>
                <TableHead className="min-w-[220px]">{t("columns.animal")}</TableHead>
                <TableHead className="min-w-[220px]">{t("columns.source")}</TableHead>
                <TableHead className="w-[160px]">{t("columns.quantity")}</TableHead>
                <TableHead className="w-[130px]">{t("columns.status")}</TableHead>
                <TableHead className="w-12 text-center">{t("cowHistory.columnLabel")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((cow) => {
                const isSelected = selection.isSelected(cow.cattle_id);
                const hasConfirmed = cow.confirmed_offered_kg != null;
                const hasDraft = cow.drafts.length > 0;
                const isCarried = carriedOver[cow.cattle_id] ?? false;
                const rowSource = sources[cow.cattle_id];
                const qtyVal = quantities[cow.cattle_id] ?? "";

                return (
                  <TableRow
                    key={cow.cattle_id}
                    className={cn(
                      "transition-colors hover:bg-muted/40",
                      isSelected && "bg-primary/[0.04]",
                    )}
                  >
                    {/* Checkbox */}
                    <TableCell className="text-center">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => selection.toggle(cow.cattle_id)}
                        aria-label={t("selectCow", { name: cow.name ?? cow.tag_number })}
                      />
                    </TableCell>

                    {/* Animal (Cow Name + Tag ID) */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {(cow.name?.[0] ?? cow.tag_number?.[0] ?? "C").toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <AnimalLink
                            id={cow.cattle_id}
                            animalName={cow.name}
                            tagNumber={cow.tag_number}
                            className="truncate text-sm font-semibold text-foreground hover:text-primary transition-colors"
                          >
                            {cow.name ?? cow.tag_number}
                          </AnimalLink>
                          <span className="truncate font-mono text-xs text-muted-foreground">
                            {cow.tag_number}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Feed Source Selector */}
                    <TableCell>
                      <RowSourceCell
                        value={rowSource}
                        stockOptions={stockOptions}
                        onChange={(next) => {
                          setSources((prev) => ({ ...prev, [cow.cattle_id]: next }));
                          if (!isSelected) selection.toggle(cow.cattle_id);
                        }}
                        onOpen={() => {
                          if (!isSelected) selection.toggle(cow.cattle_id);
                        }}
                        t={t}
                      />
                    </TableCell>

                    {/* Quantity (KG) Input */}
                    <TableCell>
                      <QuantityCell
                        value={qtyVal}
                        isCarriedOver={isCarried}
                        hasDraft={hasDraft}
                        onChange={(next) => {
                          setQuantities((prev) => ({ ...prev, [cow.cattle_id]: next }));
                          setCarriedOver((prev) => (prev[cow.cattle_id] ? { ...prev, [cow.cattle_id]: false } : prev));
                          if (!isSelected) selection.toggle(cow.cattle_id);
                        }}
                        onFocus={() => {
                          if (!isSelected) selection.toggle(cow.cattle_id);
                        }}
                        t={t}
                      />
                    </TableCell>

                    {/* Status Badge */}
                    <TableCell>
                      {hasConfirmed ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                          <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" />
                          {t("statusBadges.confirmed")}
                        </span>
                      ) : hasDraft ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-800 dark:text-blue-300">
                          <Clock className="size-3 text-blue-600 dark:text-blue-400" />
                          {t("statusBadges.draft")}
                        </span>
                      ) : isCarried ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex cursor-help items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                              <History className="size-3 text-amber-600 dark:text-amber-400" />
                              {t("statusBadges.carriedOver")}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{t("carriedOverHint")}</TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-xs text-muted-foreground/40 font-mono">—</span>
                      )}
                    </TableCell>

                    {/* History (last column, per user request — not beside the name) */}
                    <TableCell className="text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0 text-muted-foreground hover:text-primary"
                            aria-label={t("cowHistory.openButton", { name: cow.name ?? cow.tag_number })}
                            onClick={() => setHistoryCow({ id: cow.cattle_id, name: cow.name ?? cow.tag_number })}
                          >
                            <History className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("cowHistory.openButton", { name: cow.name ?? cow.tag_number })}</TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {cows.length > DEFAULT_PAGE_SIZE ? (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      ) : null}

      {/* Summary & Sticky Action Bar */}
      <Can I="feed.distribution-log">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="size-2 rounded-full bg-primary" />
              {t("summary.selectedCount", { count: selection.selectedIds.length, total: cows.length })}
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="font-semibold text-foreground">
              {t("summary.totalOffered", { total: totalSelectedOfferedKg.toFixed(1) })}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  disabled={isPending || !canSubmit}
                  onClick={handleSave}
                  className="shadow-2xs font-medium"
                >
                  {pendingAction === "save" && saveDraft.isPending ? t("saving") : t("summary.saveDraft")}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("draftHint")}</TooltipContent>
            </Tooltip>

            <Button
              disabled={isPending || !canSubmit}
              onClick={handleConfirmClick}
              className="gap-1.5 font-medium shadow-2xs"
            >
              <Check className="size-4" />
              {pendingAction === "confirm" && confirmDraft.isPending
                ? t("confirming")
                : t("summary.confirmFeeding", { count: selection.selectedIds.length })}
            </Button>
          </div>
        </div>
      </Can>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("confirmDialog.title")}
        description={t("confirmDialog.description", { count: selection.selectedIds.length })}
        confirmLabel={t("confirmDialog.confirm")}
        variant="primary"
        onConfirm={handleConfirmDialog}
      />

      <FeedItemFormDialog
        open={addFeedItemOpen}
        onOpenChange={setAddFeedItemOpen}
        onCreated={(item) => setItemId(item.id)}
      />
      <CreateFeedDialog open={createOpen} onOpenChange={setCreateOpen} kind={createKind} />

      <FeedingCowHistorySheet
        key={historyCow?.id ?? "none"}
        cattleId={historyCow?.id ?? null}
        cattleName={historyCow?.name ?? null}
        onOpenChange={(next) => {
          if (!next) setHistoryCow(null);
        }}
      />
    </>
  );
}

/** The quantity cell — sleek numeric input with seamless transparent input and clean states */
function QuantityCell({
  value,
  isCarriedOver,
  hasDraft,
  onChange,
  onFocus,
  t,
}: {
  value: string;
  isCarriedOver: boolean;
  hasDraft?: boolean;
  onChange: (next: string) => void;
  onFocus: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div
      className={cn(
        "flex h-8.5 w-28 items-center rounded-lg border bg-background px-2.5 shadow-2xs transition-all",
        isCarriedOver
          ? "border-amber-400/90 bg-amber-500/[0.05] focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20"
          : hasDraft
            ? "border-blue-400/90 bg-blue-500/[0.05] focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20"
            : "border-input/80 hover:border-input focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
      )}
    >
      <input
        type="number"
        min={0}
        step={0.1}
        placeholder="—"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        className="h-full w-full min-w-0 bg-transparent p-0 text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {isCarriedOver ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <History className="ml-1 size-3.5 shrink-0 text-amber-600 dark:text-amber-400 cursor-help" aria-hidden />
          </TooltipTrigger>
          <TooltipContent>{t("carriedOverHint")}</TooltipContent>
        </Tooltip>
      ) : null}
      <span className="ml-1 shrink-0 text-xs font-medium text-muted-foreground/70">kg</span>
    </div>
  );
}

/**
 * Row source picker — a clean, clickable button trigger that opens the search-and-select combobox.
 */
function RowSourceCell({
  value,
  stockOptions,
  onChange,
  onOpen,
  t,
}: {
  value: RowSource | null;
  stockOptions: FeedSourceOption[];
  onChange: (next: RowSource | null) => void;
  onOpen: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const stockOption = value?.sourceType === "FEED_STOCK"
    ? stockOptions.find((opt) => opt.id === value.itemId)
    : null;
  const stockLabel = stockOption?.label ?? (value?.sourceType === "FEED_STOCK" ? value.itemId : null);

  const selectedItemDetail = useFeedItemDetail(value?.sourceType === "FEED_ITEM" ? value.itemId : undefined);
  const label =
    value?.sourceType === "FEED_ITEM"
      ? (selectedItemDetail.data
          ? `${selectedItemDetail.data.name} (${selectedItemDetail.data.currentStock} ${selectedItemDetail.data.unit.symbol})`
          : value.itemId)
      : stockLabel;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) onOpen();
    else setSearch("");
  }

  function select(next: RowSource) {
    onChange(next);
    setOpen(false);
    setSearch("");
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 min-w-[150px] max-w-[220px] items-center justify-between gap-1.5 rounded-lg border px-2.5 text-left text-xs font-medium transition-colors shadow-2xs",
            label
              ? "border-border bg-card text-foreground hover:bg-muted/60"
              : "border-dashed border-input bg-muted/20 text-muted-foreground hover:border-primary/50 hover:bg-card hover:text-foreground",
          )}
        >
          {label ? (
            <span className="truncate font-medium">{label}</span>
          ) : (
            <span className="flex items-center gap-1 font-normal">
              <Plus className="size-3 text-muted-foreground" />
              {t("rowSource.selectPrompt")}
            </span>
          )}
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 sm:w-80 p-0 shadow-lg" align="start">
        {open ? (
          <RowSourceCellOptions
            search={search}
            onSearchChange={setSearch}
            stockOptions={stockOptions}
            value={value}
            onSelect={select}
            onClear={() => {
              onChange(null);
              setOpen(false);
            }}
            t={t}
          />
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/** The picker body — split out of `RowSourceCell` so it only mounts while open */
function RowSourceCellOptions({
  search,
  onSearchChange,
  stockOptions,
  value,
  onSelect,
  onClear,
  t,
}: {
  search: string;
  onSearchChange: (next: string) => void;
  stockOptions: FeedSourceOption[];
  value: RowSource | null;
  onSelect: (next: RowSource) => void;
  onClear: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const feedItems = useFeedItemPagedList({ search: search || undefined });
  const feedItemOptions: FeedSourceOption[] = useMemo(
    () =>
      feedItems.items.map((item) => ({
        id: item.id,
        label: `${item.name} (${item.currentStock} ${item.unit.symbol})`,
      })),
    [feedItems.items],
  );
  const filteredStock = useMemo(
    () => stockOptions.filter((opt) => opt.label.toLowerCase().includes(search.toLowerCase())),
    [stockOptions, search],
  );

  return (
    <>
      <Command shouldFilter={false}>
        <CommandInput placeholder={t("rowSource.searchPlaceholder")} value={search} onValueChange={onSearchChange} />
        <CommandList className="max-h-60">
          <CommandEmpty>{t("noItemsFound")}</CommandEmpty>
          {feedItemOptions.length > 0 ? (
            <CommandGroup heading={t("rowSource.purchasedGroup")}>
              {feedItemOptions.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={opt.id}
                  onSelect={() => onSelect({ sourceType: "FEED_ITEM", itemId: opt.id })}
                  className="flex items-center gap-2 cursor-pointer py-2"
                >
                  <Check
                    className={cn(
                      "size-4 text-primary shrink-0",
                      value?.sourceType === "FEED_ITEM" && value.itemId === opt.id ? "opacity-100" : "opacity-0",
                    )}
                    aria-hidden
                  />
                  <span className="truncate">{opt.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {filteredStock.length > 0 ? (
            <CommandGroup heading={t("rowSource.preparedGroup")}>
              {filteredStock.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={opt.id}
                  onSelect={() => onSelect({ sourceType: "FEED_STOCK", itemId: opt.id })}
                  className="flex items-center gap-2 cursor-pointer py-2"
                >
                  <Check
                    className={cn(
                      "size-4 text-primary shrink-0",
                      value?.sourceType === "FEED_STOCK" && value.itemId === opt.id ? "opacity-100" : "opacity-0",
                    )}
                    aria-hidden
                  />
                  <span className="truncate">{opt.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      </Command>
      {value ? (
        <div className="border-t border-border p-1 bg-muted/20">
          <Button type="button" variant="ghost" size="sm" className="w-full justify-start gap-2 text-destructive hover:bg-destructive/10" onClick={onClear}>
            <X className="size-3.5" aria-hidden />
            {t("rowSource.clear")}
          </Button>
        </div>
      ) : null}
    </>
  );
}

