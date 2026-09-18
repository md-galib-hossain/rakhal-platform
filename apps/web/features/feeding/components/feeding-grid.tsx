"use client"; // date/group filter state + per-cow draft quantities + bulk-assign source item + save/confirm mutations

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
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
import { useFeedItemPagedList } from "@/features/inventory/hooks/use-inventory";
import { FeedItemFormDialog } from "@/features/inventory/components/feed-item-form-dialog";
import { CreateFeedDialog } from "../../feed/components/create-feed-dialog";
import {
  useConcentrations,
  useFeedGroups,
  useFeedGrid,
  useFeedGridCalendar,
  useConfirmFeedDraft,
  useSaveFeedDraft,
  useFeedStock,
} from "../../feed/hooks/use-feed";
import type { FeedGridCow, FeedGridEntryInput, FeedGridSourceType } from "../../feed/types";

interface FeedSourceOption {
  id: string;
  label: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const ALL_GROUPS = "__all__";

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

/** The whole grid's Save/Confirm calls carry exactly one source item (`sourceType` + one id) — a
 * feeding round is "these cows got fed this one item today", not a per-row item choice. Derived from
 * whichever draft line already exists (first cow with a draft), so reopening the grid on a date that
 * already has staged entries shows the right item pre-selected instead of forcing a re-pick. */
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
 * "Feeding Grid" (2026-08-15, replaces Quick Feed) — per-day, per-cow feed entry. `FeedingGridTable`
 * is remounted via `key={date}` (Milk Log's pattern, `milk-log-table.tsx` comment ~289-294) so its
 * local draft/selection state always re-seeds fresh from that day's `GET /feed/grid` response with no
 * `useEffect` resync — switching dates just throws away the previous table and mounts a new one.
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
    <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <p className="text-lg font-medium text-foreground">{t("title")}</p>
        <div className="flex flex-wrap items-center gap-2.5">
          <Select value={feedGroupId} onValueChange={setFeedGroupId}>
            <SelectTrigger className="w-[160px]" aria-label={t("groupFilterLabel")}>
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

          <div className="w-[160px] shrink-0">
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
        <CardSkeleton lines={4} />
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
  const feedItems = useFeedItemPagedList({});
  const feedStock = useFeedStock();
  const concentrations = useConcentrations();

  const [quantities, setQuantities] = useState<Record<string, string>>(() => buildInitialQuantities(cows));
  // Pre-checks any cow that already has a staged draft for this date (see `buildInitialSelection`'s
  // doc comment) — computed once via the lazy `useState` initializer since this whole table remounts
  // via `key={date}` on every date change, same seeding pattern as `quantities` above.
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
  const [itemSearch, setItemSearch] = useState("");

  const feedItemOptions: FeedSourceOption[] = useMemo(
    () => feedItems.items.map((item) => ({ id: item.id, label: `${item.name} (${item.currentStock} ${item.unit.symbol})` })),
    [feedItems.items],
  );

  const stockOptions: FeedSourceOption[] = useMemo(
    () =>
      (feedStock.data ?? []).map((s) => ({
        id: s.id,
        label: `${concentrations.data?.find((c) => c.id === s.source_concentration_id)?.name ?? t("unknownStock")} (${s.current_stock_kg} kg)`,
      })),
    [feedStock.data, concentrations.data, t],
  );

  const sourceOptions = sourceType === "FEED_ITEM" ? feedItemOptions : stockOptions;
  const filteredSourceOptions = useMemo(
    () => sourceOptions.filter((opt) => opt.label.toLowerCase().includes(itemSearch.toLowerCase())),
    [sourceOptions, itemSearch],
  );
  const selectedSourceOption = sourceOptions.find((opt) => opt.id === itemId);

  function handleApplyBulk() {
    const kg = Number(sharedKg);
    if (!Number.isFinite(kg) || kg < 0 || selection.selectedIds.length === 0) return;
    setQuantities((prev) => {
      const next = { ...prev };
      for (const id of selection.selectedIds) next[id] = String(kg);
      return next;
    });
    selection.clear();
  }

  function buildEntries(): FeedGridEntryInput[] {
    return selection.selectedIds
      .map((cattleId) => ({ cattleId, offeredKg: Number(quantities[cattleId]) }))
      .filter((e) => Number.isFinite(e.offeredKg) && e.offeredKg > 0);
  }

  const canSubmit = Boolean(itemId) && selection.selectedIds.length > 0;

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
        sourceType,
        feedItemId: sourceType === "FEED_ITEM" ? itemId : undefined,
        feedStockId: sourceType === "FEED_STOCK" ? itemId : undefined,
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
        sourceType,
        feedItemId: sourceType === "FEED_ITEM" ? itemId : undefined,
        feedStockId: sourceType === "FEED_STOCK" ? itemId : undefined,
        entries: entries.length > 0 ? entries : undefined,
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

  return (
    <>
      <div className="flex flex-wrap items-end gap-2.5 rounded-xl border border-border bg-muted/40 p-3">
        <div className="flex h-9 gap-1 rounded-md border border-border bg-card p-1">
          {(["FEED_ITEM", "FEED_STOCK"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setSourceType(value);
                setItemId("");
                setItemSearch("");
              }}
              className={cn(
                "flex items-center justify-center rounded-md px-2.5 text-xs font-bold transition-colors",
                sourceType === value ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {t(`sourceType.${value}`)}
            </button>
          ))}
        </div>

        <Popover
          open={itemPickerOpen}
          onOpenChange={(next) => {
            setItemPickerOpen(next);
            if (!next) setItemSearch("");
          }}
          // Non-modal — same defense-in-depth reason `ingredient-picker.tsx`/`cattle-picker.tsx`
          // keep this off: no scroll-lock parent here, but the picker's own footer buttons
          // (`onCreated` re-opens this same row) shouldn't ever fight a focus trap.
          modal={false}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={itemPickerOpen}
              aria-label={t("itemLabel")}
              className={cn("h-9 w-[220px] justify-between font-normal", !selectedSourceOption && "text-muted-foreground")}
            >
              <span className="truncate">{selectedSourceOption?.label ?? t("itemPlaceholder")}</span>
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0">
            <Command shouldFilter={false}>
              <CommandInput placeholder={t("searchItemPlaceholder")} value={itemSearch} onValueChange={setItemSearch} />
              <CommandList>
                <CommandEmpty>{t("noItemsFound")}</CommandEmpty>
                <CommandGroup>
                  {filteredSourceOptions.map((opt) => (
                    <CommandItem
                      key={opt.id}
                      value={opt.id}
                      onSelect={() => {
                        setItemId(opt.id);
                        setItemPickerOpen(false);
                      }}
                    >
                      <Check className={cn("mr-2 size-4", opt.id === itemId ? "opacity-100" : "opacity-0")} aria-hidden />
                      {opt.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
            <div className="flex flex-col border-t border-border p-1">
              {sourceType === "FEED_ITEM" ? (
                <button
                  type="button"
                  onClick={() => {
                    setItemPickerOpen(false);
                    setAddFeedItemOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-primary transition-colors hover:bg-muted"
                >
                  <Plus className="size-4" aria-hidden /> {t("addFeedItem")}
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
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-primary transition-colors hover:bg-muted"
                  >
                    <Plus className="size-4" aria-hidden /> {t("createConcentrate")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setItemPickerOpen(false);
                      setCreateKind("FEED_MIXTURE");
                      setCreateOpen(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-primary transition-colors hover:bg-muted"
                  >
                    <Plus className="size-4" aria-hidden /> {t("createTmr")}
                  </button>
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex h-9 w-28 items-center gap-1 rounded-md border border-border bg-card px-2 text-sm">
          <Input
            type="number"
            min={0}
            step={0.1}
            placeholder={t("kgPerHeadPlaceholder")}
            className="h-auto w-full border-none p-0 text-sm shadow-none focus-visible:ring-0"
            value={sharedKg}
            onChange={(e) => setSharedKg(e.target.value)}
          />
          <span className="shrink-0 text-xs text-muted-foreground">kg</span>
        </div>

        <Button variant="outline" size="sm" disabled={selection.selectedIds.length === 0 || !sharedKg} onClick={handleApplyBulk}>
          {t("applyToSelected", { count: selection.selectedIds.length })}
        </Button>
      </div>

      {cows.length === 0 ? (
        <EmptyState title={t("noCattle")} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selection.isAllSelected}
                    onCheckedChange={() => selection.toggleAll()}
                    aria-label={t("selectAll")}
                  />
                </TableHead>
                <TableHead>{t("columns.cowId")}</TableHead>
                <TableHead>{t("columns.name")}</TableHead>
                <TableHead>{t("columns.quantity")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cows.map((cow) => {
                const isSelected = selection.isSelected(cow.cattle_id);
                return (
                  <TableRow key={cow.cattle_id} className={cn(isSelected && "bg-primary/5")}>
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => selection.toggle(cow.cattle_id)}
                        aria-label={t("selectCow", { name: cow.name ?? cow.tag_number })}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      <AnimalLink
                        id={cow.cattle_id}
                        tagNumber={cow.tag_number}
                        className="text-foreground hover:text-primary"
                      >
                        {cow.tag_number}
                      </AnimalLink>
                    </TableCell>
                    <TableCell className="text-foreground">
                      <AnimalLink
                        id={cow.cattle_id}
                        animalName={cow.name}
                        tagNumber={cow.tag_number}
                        className="text-foreground hover:text-primary"
                      >
                        {cow.name ?? cow.tag_number}
                      </AnimalLink>
                    </TableCell>
                    <TableCell>
                      <div
                        className={cn(
                          "flex h-9 w-28 items-center gap-1 rounded-md bg-card px-1.5 shadow-xs transition-opacity",
                          !isSelected && "opacity-50",
                        )}
                      >
                        <Input
                          type="number"
                          min={0}
                          step={0.1}
                          className="h-auto w-full border-none p-0 text-sm leading-none shadow-none focus-visible:ring-0"
                          value={quantities[cow.cattle_id] ?? ""}
                          onChange={(e) =>
                            setQuantities((prev) => ({ ...prev, [cow.cattle_id]: e.target.value }))
                          }
                          onFocus={() => {
                            if (!isSelected) selection.toggle(cow.cattle_id);
                          }}
                        />
                        <span className="shrink-0 text-xs text-muted-foreground">kg</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Can I="feed.distribution-log">
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" disabled={isPending || !canSubmit} onClick={handleSave}>
            {pendingAction === "save" && saveDraft.isPending ? t("saving") : t("save")}
          </Button>
          <Button disabled={isPending || !canSubmit} onClick={handleConfirmClick}>
            {pendingAction === "confirm" && confirmDraft.isPending ? t("confirming") : t("confirm")}
          </Button>
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
    </>
  );
}
