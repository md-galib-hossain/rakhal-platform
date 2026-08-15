"use client"; // date/group filter state + per-cow draft quantities + bulk-assign source item + save/confirm mutations

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Can } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { useGridBulkSelection } from "@/lib/hooks/use-bulk-selection";
import { useFeedItemPagedList } from "@/features/inventory/hooks/use-inventory";
import { useConcentrations, useFeedGroups, useFeedGrid, useConfirmFeedDraft, useSaveFeedDraft, useFeedStock } from "../../feed/hooks/use-feed";
import type { FeedGridCow, FeedGridEntryInput, FeedGridSourceType } from "../../feed/types";

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
  const locale = useLocale() as Locale;
  const [date, setDate] = useState(todayIso());
  const [feedGroupId, setFeedGroupId] = useState(ALL_GROUPS);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const groupFilter = feedGroupId === ALL_GROUPS ? undefined : feedGroupId;
  const query = useFeedGrid(date, groupFilter);
  const feedGroups = useFeedGroups();

  const cows = query.data?.cows ?? [];

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <p className="text-lg font-medium text-foreground">{t("title")}</p>
        <div className="flex flex-wrap items-center gap-2.5">
          <Select value={feedGroupId} onValueChange={setFeedGroupId}>
            <SelectTrigger className="h-9 w-[160px] rounded-lg text-xs shadow-xs" aria-label={t("groupFilterLabel")}>
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

          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground shadow-xs"
              >
                {formatDate(date, locale)}
                <CalendarDays className="size-3.5" aria-hidden />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={new Date(date)}
                defaultMonth={new Date(date)}
                onSelect={(next) => {
                  if (!next) return;
                  setDate(format(next, "yyyy-MM-dd"));
                  setCalendarOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
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

  const stockOptions = useMemo(
    () =>
      (feedStock.data ?? []).map((s) => ({
        id: s.id,
        label: `${concentrations.data?.find((c) => c.id === s.source_concentration_id)?.name ?? t("unknownStock")} (${s.current_stock_kg} kg)`,
      })),
    [feedStock.data, concentrations.data, t],
  );

  function handleApplyBulk() {
    const kg = Number(sharedKg);
    if (!Number.isFinite(kg) || kg < 0 || selection.selectedIds.length === 0) return;
    setQuantities((prev) => {
      const next = { ...prev };
      for (const id of selection.selectedIds) next[id] = String(kg);
      return next;
    });
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
        <div className="flex h-9 gap-1 rounded-lg border border-border bg-card p-1">
          {(["FEED_ITEM", "FEED_STOCK"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setSourceType(value);
                setItemId("");
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

        <Select value={itemId} onValueChange={setItemId}>
          <SelectTrigger className="h-9 w-[220px] rounded-lg text-xs shadow-xs" aria-label={t("itemLabel")}>
            <SelectValue placeholder={t("itemPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {sourceType === "FEED_ITEM"
              ? feedItems.items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} ({item.currentStock} {item.unit.symbol})
                  </SelectItem>
                ))
              : stockOptions.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.label}
                  </SelectItem>
                ))}
          </SelectContent>
        </Select>

        <div className="flex h-9 w-28 items-center gap-1 rounded-lg border border-border bg-card px-2 text-sm">
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
                    <TableCell className="font-medium text-foreground">{cow.tag_number}</TableCell>
                    <TableCell className="text-foreground">{cow.name ?? cow.tag_number}</TableCell>
                    <TableCell>
                      <div
                        className={cn(
                          "flex h-9 w-28 items-center gap-1 rounded-sm bg-card px-1.5 shadow-xs transition-opacity",
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
    </>
  );
}
