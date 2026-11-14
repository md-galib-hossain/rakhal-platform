"use client"; // date filter + per-cow line/refusal state + selection + bulk apply + save/confirm mutations

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { parseAsString, useQueryState } from "nuqs";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronsUpDown,
  ClipboardList,
  History,
  Layers,
  Plus,
  Scale,
  Search,
  Wheat,
} from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { Button } from "@rakhal/ui/ui/button";
import { Checkbox } from "@rakhal/ui/ui/checkbox";
import { Input } from "@rakhal/ui/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rakhal/ui/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@rakhal/ui/ui/tooltip";
import { EntryStatusDatePicker } from "@/components/shared/entry-status-date-picker";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@rakhal/ui/shared/confirm-dialog";
import { AnimalLink } from "@/components/shared/animal-link";
import { Can } from "@/lib/auth/permissions";
import { FeedItemFormDialog } from "@/features/inventory/components/feed-item-form-dialog";
import { CreateFeedDialog } from "../../feed/components/create-feed-dialog";
import {
  useFeedGrid,
  useFeedGridCalendar,
  useFeedStock,
  useConcentrations,
} from "../../feed/hooks/use-feed";
import { useConfirmProgram, useSaveProgramDraft } from "../../feed/hooks/use-feed-plans";
import { useRequirementSettings } from "../../feed/hooks/use-requirement-settings";
import type { FeedGridResult } from "../../feed/types";
import type { FeedGridProgramCowFields, FeedGridSection, FeedPlan } from "../../feed/plans-types";
import {
  bandsFromEffective,
  buildInitialLines,
  cowTotalKg,
  liveFit,
  liveSupply,
  type Density,
  enforceStockCaps,
  hasOverStock,
  initialRefusal,
  isFedToday,
  newLineKey,
  orderCows,
  parseKg,
  remainingRequirement,
  requirementProgress,
  sourceKey,
  todayLocalIso,
  toEntry,
  usageBySource,
  type GridCow,
  type RowLine,
  type RowSource,
} from "../grid-model";
import { useSourceStock } from "../hooks/use-source-stock";
import { ApplyPlanDialog, type ApplyTarget } from "../../feed/components/plans/apply-plan-dialog";
import { ProgramPicker } from "./program-picker";
import { FeedLineCell } from "./feed-line-cell";
import { FeedSourcePicker, type PreparedOption } from "./feed-source-picker";
import { FeedingCowHistorySheet } from "./feeding-cow-history-sheet";
import { RequirementProgress } from "./requirement-progress";
import { FitPill } from "./fit-pill";

// Row virtualization: below `md` each cow is a card in a flex column with `gap-3` (12px); the
// virtualizer must know that gap or its offsets drift. Row heights are measured, these are first guesses.
const MOBILE_QUERY = "(max-width: 767px)";
const MOBILE_ROW_GAP = 12;
const ESTIMATED_ROW_PX = 143;
const ESTIMATED_CARD_PX = 360;
/** Stands in for the unmounted rows above/below the window so the page keeps its full scroll height. */
function TableSpacer({ height }: { height: number }) {
  return (
    <tr aria-hidden style={{ height }}>
      <td colSpan={7} style={{ height, padding: 0, border: 0 }} />
    </tr>
  );
}
const subscribeMobile =(onChange: () => void) => {
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
};
/** checkbox · animal (+ program) · feed (+ total) · refusal · fit · status · history */
const COLUMN_COUNT = 7;

const todayIso = todayLocalIso;

/**
 * "Feeding Grid" — per-day, per-cow feed entry in ONE table. Every cow is a row of feed lines: a cow on a feed plan
 * (or a TMR / concentrate shortcut) opens with her plan's lines pre-filled and editable; any other cow is fed from
 * whatever is picked. Rows are grouped by program only visually — the columns, the bulk toolbar and the
 * Save / Confirm bar are shared. `UnifiedGrid` remounts on date change (and after a save) so its local state always
 * re-seeds from the server's `GET /feed/grid`.
 */
export function FeedingGrid() {
  const t = useTranslations("feeding.grid");
  const [date, setDate] = useState(todayIso());
  const [calendarMonth, setCalendarMonth] = useState(todayIso().slice(0, 7));
  const [resetToken, setResetToken] = useState(0);
  const query = useFeedGrid(date);
  const calendarQuery = useFeedGridCalendar(calendarMonth);

  const data = query.data as
    | (Omit<FeedGridResult, "cows"> & {
        sections?: FeedGridSection[];
        cows: (FeedGridResult["cows"][number] & FeedGridProgramCowFields)[];
      })
    | undefined;

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-card sm:p-5">
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

      {query.isLoading ? (
        <CardSkeleton lines={6} />
      ) : query.isError ? (
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      ) : (
        <UnifiedGrid
          key={`${date}:${resetToken}`}
          date={date}
          cows={(data?.cows ?? []) as GridCow[]}
          sections={data?.sections ?? []}
          onPersisted={async () => {
            await query.refetch();
            setResetToken((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

function UnifiedGrid({
  date,
  cows,
  sections,
  onPersisted,
}: {
  date: string;
  cows: GridCow[];
  sections: FeedGridSection[];
  onPersisted: () => Promise<void>;
}) {
  const t = useTranslations("feeding.grid");
  const tu = useTranslations("feeding.grid.unified");
  const tp = useTranslations("feeding.programs");

  const saveDraft = useSaveProgramDraft();
  const confirmProgram = useConfirmProgram();
  const feedStock = useFeedStock();
  const concentrations = useConcentrations();

  const [urlCattleId] = useQueryState("cattleId", parseAsString);
  const [urlSelected] = useQueryState("selected", parseAsString);
  const [urlAnimalId] = useQueryState("animalId", parseAsString);
  const targetCattleId = urlCattleId || urlSelected || urlAnimalId;

  const ordered = useMemo(() => orderCows(cows, sections), [cows, sections]);
  const sectionById = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections]);
  const cowById = useMemo(() => new Map(ordered.map((c) => [c.cattle_id, c])), [ordered]);

  const [lines, setLines] = useState<Record<string, RowLine[]>>(() =>
    Object.fromEntries(
      ordered.map((c) => [
        c.cattle_id,
        buildInitialLines(c, c.program_section_id ? sectionById.get(c.program_section_id) : undefined),
      ]),
    ),
  );
  const [refusals, setRefusals] = useState<Record<string, string>>(() =>
    Object.fromEntries(ordered.map((c) => [c.cattle_id, initialRefusal(c)])),
  );
  // Cows on a program start ticked with the plan's kg pre-filled — confirm as planned, or edit first. Cows with a saved
  // draft are ticked too, so re-opening a day shows exactly what was left staged. If a specific cattle was targeted via URL,
  // select only that cow.
  const [selected, setSelected] = useState<Set<string>>(
    () => {
      if (targetCattleId && ordered.some((c) => c.cattle_id === targetCattleId)) {
        return new Set([targetCattleId]);
      }
      return new Set(
        ordered
          .filter((c) => (c.program_section_id || c.drafts.length > 0) && !isFedToday(c))
          .map((c) => c.cattle_id),
      );
    },
  );
  // Apply a plan / TMR / concentrate to one cow (her row) or to every ticked cow (toolbar).
  const [applyTarget, setApplyTarget] = useState<ApplyTarget | null>(null);
  const [applyCows, setApplyCows] = useState<{ id: string; label: string }[]>([]);
  const appliedRef = useRef(false);
  const [bulkSources, setBulkSources] = useState<RowSource[]>([]);
  const [sharedKg, setSharedKg] = useState("");
  const [search, setSearch] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [addFeedItemOpen, setAddFeedItemOpen] = useState(false);
  const [createKind, setCreateKind] = useState<"CONCENTRATE_TEMPLATE" | "FEED_MIXTURE">("CONCENTRATE_TEMPLATE");
  const [createOpen, setCreateOpen] = useState(false);
  const [historyCow, setHistoryCow] = useState<{ id: string; name: string | null } | null>(null);

  const targetHandledRef = useRef<string | null>(null);
  useEffect(() => {
    if (targetCattleId && targetHandledRef.current !== targetCattleId) {
      if (ordered.some((c) => c.cattle_id === targetCattleId)) {
        targetHandledRef.current = targetCattleId;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to a deep-link param, once per target (guarded by the ref)
        setSelected(new Set([targetCattleId]));
      }
    }
  }, [targetCattleId, ordered]);

  const toggleBulkSource = (source: RowSource, _name?: string) => {
    setBulkSources((prev) => {
      const key = sourceKey(source);
      const exists = prev.some((s) => sourceKey(s) === key);
      if (exists) {
        return prev.filter((s) => sourceKey(s) !== key);
      }
      return [...prev, source];
    });
  };

  const bulkLines: RowLine[] = useMemo(
    () => bulkSources.map((s) => ({ key: sourceKey(s), source: s, kg: "" })),
    [bulkSources],
  );

  // A cow can be fed more than once a day: every confirm is its own feeding (void one from her History if it was a
  // mistake). A fed cow is not pre-ticked and "select all" skips her, so a bulk confirm never doubles her day by accident.
  const selectedIds = useMemo(
    () => ordered.filter((c) => selected.has(c.cattle_id)).map((c) => c.cattle_id),
    [ordered, selected],
  );

  // ---- stock ---------------------------------------------------------------------------------------------------
  const sources = useMemo(() => {
    const out: RowSource[] = [];
    for (const rowLines of Object.values(lines)) for (const l of rowLines) if (l.source) out.push(l.source);
    for (const s of bulkSources) out.push(s);
    return out;
  }, [lines, bulkSources]);
  const stock = useSourceStock(sources, t("unknownStock"));
  const usage = useMemo(() => usageBySource(lines, selectedIds), [lines, selectedIds]);

  // ---- live fit: the pill follows the kg typed in the row, not the plan as written ---------------------------------
  const requirementSettings = useRequirementSettings();
  const bands = useMemo(() => bandsFromEffective(requirementSettings.data?.effective), [requirementSettings.data]);
  const planDensity = useMemo(() => {
    const map = new Map<string, Density>();
    for (const s of sections) {
      for (const l of s.lines) {
        if (l.source && l.density) {
          map.set(sourceKey({ sourceType: l.source.source_type, itemId: (l.source.feed_item_id ?? l.source.feed_stock_id) as string }), l.density);
        }
      }
    }
    return map;
  }, [sections]);
  const densityFor = (key: string) => planDensity.get(key) ?? stock.get(key)?.density ?? null;

  const preparedOptions: PreparedOption[] = useMemo(
    () =>
      (feedStock.data ?? [])
        .filter((s) => s.current_stock_kg > 0)
        .map((s) => ({
          id: s.id,
          label: `${concentrations.data?.find((c) => c.id === s.source_concentration_id)?.name ?? t("unknownStock")} (${s.current_stock_kg} kg)`,
        })),
    [feedStock.data, concentrations.data, t],
  );

  // ---- row edits -----------------------------------------------------------------------------------------------
  const ensureSelected = (id: string) => setSelected((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectMany = (ids: string[]) => setSelected((prev) => new Set([...prev, ...ids]));

  const changeKg = (cowId: string, lineKey: string, kg: string) =>
    setLines((p) => ({
      ...p,
      [cowId]: (p[cowId] ?? []).map((l) => (l.key === lineKey ? { ...l, kg } : l)),
    }));
  const removeLine = (cowId: string, lineKey: string) =>
    setLines((p) => ({ ...p, [cowId]: (p[cowId] ?? []).filter((l) => l.key !== lineKey) }));
  const removeAllLines = (cowId: string) =>
    setLines((p) => ({ ...p, [cowId]: [] }));
  const addLine = (cowId: string, source: RowSource, name?: string) =>
    setLines((p) => {
      const cur = p[cowId] ?? [];
      if (cur.some((l) => l.source && sourceKey(l.source) === sourceKey(source))) return p;
      return { ...p, [cowId]: [...cur, { key: newLineKey(), source, name, kg: "" }] };
    });

  const toggleSource = (cowId: string, source: RowSource, name?: string) => {
    setLines((p) => {
      const cur = p[cowId] ?? [];
      const key = sourceKey(source);
      const exists = cur.some((l) => l.source && sourceKey(l.source) === key);
      if (exists) {
        return {
          ...p,
          [cowId]: cur.filter((l) => !l.source || sourceKey(l.source) !== key),
        };
      } else {
        return {
          ...p,
          [cowId]: [...cur, { key: newLineKey(), source, name, kg: "" }],
        };
      }
    });
    ensureSelected(cowId);
  };

  function planToRowLines(plan: FeedPlan): RowLine[] {
    const stockLots = feedStock.data ?? [];
    return plan.lines.map((pl) => {
      let source: RowSource | null = null;
      if (pl.line_type === "FEED_ITEM" && pl.feed_item_id) {
        source = { sourceType: "FEED_ITEM", itemId: pl.feed_item_id };
      } else if (pl.line_type === "PREPARED" && pl.concentration_id) {
        const lot = stockLots.find((s) => s.source_concentration_id === pl.concentration_id && s.current_stock_kg > 0);
        if (lot) {
          source = { sourceType: "FEED_STOCK", itemId: lot.id };
        }
      }
      return {
        key: newLineKey(),
        planLineId: pl.id,
        name: pl.name ?? undefined,
        source,
        kg: pl.kg_per_day > 0 ? String(pl.kg_per_day) : "",
      };
    });
  }

  const applyPlanToCow = (cowId: string, plan: FeedPlan) => {
    const newLines = planToRowLines(plan);
    setLines((p) => ({
      ...p,
      [cowId]: newLines,
    }));
    ensureSelected(cowId);
  };

  const applyPlanToSelected = (plan: FeedPlan) => {
    if (selectedIds.length === 0) {
      toast.info(t("bulkToolbar.selectFirstHint"));
      return;
    }
    const template = planToRowLines(plan);
    const next = { ...lines };
    for (const id of selectedIds) {
      next[id] = template.map((l) => ({ ...l, key: newLineKey() }));
    }
    const capped = enforceStockCaps(next, selectedIds, stock);
    setLines(capped.lines);
    toast.success(tu("appliedToast", { count: selectedIds.length }));
  };

  const cowLabel = (id: string) => {
    const c = cowById.get(id);
    return c ? (c.name ? `${c.name} (${c.tag_number})` : c.tag_number) : id;
  };
  function openApply(target: ApplyTarget, ids: string[]) {
    setApplyCows(ids.map((id) => ({ id, label: cowLabel(id) })));
    setApplyTarget(target);
  }

  // ---- bulk apply ----------------------------------------------------------------------------------------------
  const kgNumber = sharedKg.trim() === "" ? null : Number(sharedKg);
  const hasKg = kgNumber != null && Number.isFinite(kgNumber) && kgNumber >= 0;

  function handleApply() {
    if (selectedIds.length === 0 || (bulkSources.length === 0 && !hasKg)) return;
    const next = { ...lines };
    let skipped = 0;
    for (const id of selectedIds) {
      const cow = cowById.get(id);
      const cur = next[id] ? [...next[id]] : [];
      if (bulkSources.length > 0) {
        if (!cow?.program_section_id && cur.length === 0) {
          next[id] = bulkSources.map((bs) => ({
            key: newLineKey(),
            source: bs,
            kg: hasKg ? String(kgNumber) : "",
          }));
        } else {
          const updated = [...cur];
          for (const bs of bulkSources) {
            const key = sourceKey(bs);
            const same = (l: RowLine) => l.source != null && sourceKey(l.source) === key;
            const idx = updated.findIndex(same);
            if (idx >= 0) {
              if (hasKg) updated[idx] = { ...updated[idx], kg: String(kgNumber) };
            } else {
              updated.push({
                key: newLineKey(),
                source: bs,
                kg: hasKg ? String(kgNumber) : "",
              });
            }
          }
          next[id] = updated;
        }
      } else if (hasKg) {
        // kg only: unambiguous for a one-line cow; a multi-line cow needs her lines edited individually.
        const feedable = cur.filter((l) => l.source);
        if (feedable.length === 1) {
          next[id] = cur.map((l) => (l.source ? { ...l, kg: String(kgNumber) } : l));
        } else {
          skipped += 1;
        }
      }
    }
    const capped = enforceStockCaps(next, selectedIds, stock);
    setLines(capped.lines);
    toast.success(tu("appliedToast", { count: selectedIds.length - skipped }));
    if (skipped > 0) toast.info(tu("skippedMultiLine", { count: skipped }));
    if (capped.reduced > 0) toast.warning(tu("stockLimited", { count: capped.reduced }));
  }

  // ---- save / confirm ------------------------------------------------------------------------------------------
  function buildEntries() {
    return selectedIds
      .map((id) => toEntry(id, lines[id] ?? [], refusals[id] ?? ""))
      .filter((e): e is NonNullable<typeof e> => e !== null);
  }

  async function run(kind: "save" | "confirm") {
    if (hasOverStock(lines, selectedIds, stock)) {
      toast.error(tu("overStock"));
      return;
    }
    const entries = buildEntries();
    if (entries.length === 0) {
      toast.error(t("noEntries"));
      return;
    }
    try {
      if (kind === "save") {
        const result = await saveDraft.mutateAsync({ date, entries });
        toast.success(t("savedToast", { count: result.saved }));
      } else {
        const result = await confirmProgram.mutateAsync({ date, entries });
        toast.success(t("confirmedToast", { count: result.cows.length }));
      }
      await onPersisted();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  const pending = saveDraft.isPending || confirmProgram.isPending;
  const canSubmit = selectedIds.length > 0;
  const totalKg = selectedIds.reduce((sum, id) => sum + cowTotalKg(lines[id] ?? []), 0);

  // ---- table rows ----------------------------------------------------------------------------------------------
  const q = search.trim().toLowerCase();
  const filtered = q
    ? ordered.filter((c) => (c.name ?? "").toLowerCase().includes(q) || c.tag_number.toLowerCase().includes(q))
    : ordered;
  // Continuous scroll, windowed: the grid endpoint returns every cow for the day, so all rows are in
  // memory and only the ones near the viewport are mounted (spacer rows stand in for the rest).
  const isMobileLayout = useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
  const rowGap = isMobileLayout ? MOBILE_ROW_GAP : 0;
  const [scrollMargin, setScrollMargin] = useState(0);
  const virtualizer = useWindowVirtualizer({
    count: filtered.length,
    estimateSize: () => (isMobileLayout ? ESTIMATED_CARD_PX : ESTIMATED_ROW_PX),
    getItemKey: (i) => filtered[i].cattle_id,
    gap: rowGap,
    overscan: 8,
    scrollMargin,
  });
  const virtualItems = virtualizer.getVirtualItems();
  // Document-Y where the row list starts (the tbody top — spacers live inside it). Re-measured on
  // every render so content above the grid changing height can't skew the window.
  const measureBodyTop = (el: HTMLTableSectionElement | null) => {
    if (!el) return;
    const top = Math.round(el.getBoundingClientRect().top + window.scrollY);
    if (top !== scrollMargin) setScrollMargin(top);
  };
  const firstItem = virtualItems[0];
  const lastItem = virtualItems[virtualItems.length - 1];
  // A spacer inside the mobile flex column also gets a `gap`, so it is shortened by one.
  const padTop = firstItem ? Math.max(0, firstItem.start - scrollMargin - (firstItem.start - scrollMargin > 0 ? rowGap : 0)) : 0;
  const padBottomRaw = lastItem ? virtualizer.getTotalSize() - (lastItem.end - scrollMargin) : 0;
  const padBottom = Math.max(0, padBottomRaw - (padBottomRaw > 0 ? rowGap : 0));

  // Deep link (`targetCattleId`): bring that cow's row into the window and scroll to it, once per target.
  const targetIdx = targetCattleId ? filtered.findIndex((c) => c.cattle_id === targetCattleId) : -1;
  const scrolledToRef = useRef<string | null>(null);
  useEffect(() => {
    if (!targetCattleId || targetIdx < 0 || scrolledToRef.current === targetCattleId) return;
    scrolledToRef.current = targetCattleId;
    virtualizer.scrollToIndex(targetIdx, { align: "center" });
  }, [targetCattleId, targetIdx, virtualizer]);
  const unfedFiltered = filtered.filter((c) => !isFedToday(c)).map((c) => c.cattle_id);
  const allTicked = unfedFiltered.length > 0 && unfedFiltered.every((id) => selected.has(id));

  return (
    <>
      {/* Bulk toolbar — one source + one kg applied to every ticked cow */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border/80 bg-muted/40 p-3 shadow-xs">
        <div className="flex w-full flex-col gap-1.5 sm:w-auto">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Layers className="size-3.5" />
            {t("bulkToolbar.sourceSection")}
          </span>
          <FeedSourcePicker
            lines={bulkLines}
            preparedOptions={preparedOptions}
            onToggleSource={toggleBulkSource}
            onSelectPlan={applyPlanToSelected}
            onClear={() => setBulkSources([])}
            footer={(close) => (
              <>
                <button
                  type="button"
                  onClick={() => {
                    close();
                    setAddFeedItemOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-muted"
                >
                  <Plus className="size-3.5" aria-hidden /> {t("addFeedItem")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    close();
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
                    close();
                    setCreateKind("FEED_MIXTURE");
                    setCreateOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-muted"
                >
                  <Plus className="size-3.5" aria-hidden /> {t("createTmr")}
                </button>
              </>
            )}
          >
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-label={t("itemLabel")}
              className={cn(
                "h-11 w-full justify-between bg-card text-left font-normal shadow-2xs sm:w-64",
                bulkSources.length === 0 && "text-muted-foreground",
              )}
            >
              <span className="truncate">
                {bulkSources.length === 0
                  ? t("itemPlaceholder")
                  : bulkSources.length === 1
                    ? (stock.get(sourceKey(bulkSources[0]))?.label ?? "…")
                    : `${stock.get(sourceKey(bulkSources[0]))?.label ?? "…"} + ${bulkSources.length - 1} more`}
              </span>
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" aria-hidden />
            </Button>
          </FeedSourcePicker>
        </div>

        <div className="flex w-full flex-col gap-1.5 sm:w-44">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Scale className="size-3.5" />
            {t("bulkToolbar.quantitySection")}
          </span>
          <div className="flex h-11 items-center gap-2 rounded-md border border-input bg-card px-3.5 text-sm shadow-2xs focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={300}
              step={0.1}
              placeholder={t("kgPerHeadPlaceholder")}
              className="h-full w-full min-w-0 bg-transparent p-0 text-sm font-medium text-foreground outline-none shadow-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              value={sharedKg}
              onChange={(e) => {
                const val = e.target.value;
                if (val !== "") {
                  const num = Number(val);
                  if (Number.isFinite(num) && num > 300) return;
                }
                setSharedKg(val);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleApply();
                }
              }}
            />
            <span className="shrink-0 text-xs font-semibold text-muted-foreground">kg</span>
          </div>
        </div>

        <Button
          variant="primary"
          className="h-11 w-full gap-2 px-5 font-semibold shadow-2xs sm:w-auto"
          disabled={selectedIds.length === 0 || (bulkSources.length === 0 && !hasKg)}
          onClick={handleApply}
        >
          <ArrowRight className="size-4" />
          {t("bulkToolbar.applyUnified", { count: selectedIds.length })}
        </Button>

        <Can I="feed.update">
          <ProgramPicker onPick={(target) => openApply(target, selectedIds)}>
            <Button
              variant="outline"
              disabled={selectedIds.length === 0}
              className="h-11 w-full gap-2 bg-card font-medium shadow-2xs sm:w-auto"
            >
              <ClipboardList className="size-4" />
              {tu("applyProgram", { count: selectedIds.length })}
            </Button>
          </ProgramPicker>
        </Can>

        <div className="relative w-full sm:ml-auto sm:w-56">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tu("searchCows")}
            aria-label={tu("searchCows")}
            className="h-11 bg-card pl-9"
          />
        </div>
      </div>

      {/* One table for every cow */}
      {ordered.length === 0 ? (
        <EmptyState title={t("noCattle")} />
      ) : (
        <>
        {/* Phones: the header row is hidden, so select-all lives here */}
        <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground md:hidden">
          <Checkbox
            checked={allTicked}
            onCheckedChange={() =>
              setSelected((prev) => {
                const next = new Set(prev);
                for (const id of unfedFiltered) {
                  if (allTicked) next.delete(id);
                  else next.add(id);
                }
                return next;
              })
            }
            aria-label={t("selectAll")}
          />
          {t("selectAll")}
        </label>
        <div className="rounded-xl border border-border bg-card shadow-xs max-md:border-0 max-md:bg-transparent max-md:shadow-none md:overflow-x-auto">
          <Table className="max-md:block">
            <TableHeader className="bg-muted/40 max-md:hidden">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12 text-center">
                  <Checkbox
                    checked={allTicked}
                    onCheckedChange={() =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        for (const id of unfedFiltered) {
                          if (allTicked) next.delete(id);
                          else next.add(id);
                        }
                        return next;
                      })
                    }
                    aria-label={t("selectAll")}
                  />
                </TableHead>
                <TableHead className="min-w-[220px]">{t("columns.animal")}</TableHead>
                <TableHead className="min-w-[360px]">{tu("columns.feed")}</TableHead>
                <TableHead className="w-[130px]">{t("columns.refusal")}</TableHead>
                <TableHead className="min-w-[140px]">{tp("fit.title")}</TableHead>
                <TableHead className="w-[150px]">{t("columns.requirement")}</TableHead>
                <TableHead className="w-12 text-center">{t("cowHistory.columnLabel")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody ref={measureBodyTop} className="max-md:flex max-md:flex-col max-md:gap-3">
              {padTop > 0 ? <TableSpacer height={padTop} /> : null}
              {virtualItems.map((item) => {
                const index = item.index;
                const cow = filtered[index];
                const rowLines = lines[cow.cattle_id] ?? [];
                const fed = isFedToday(cow);
                const isSelected = selected.has(cow.cattle_id);
                const cowName = cow.name ?? cow.tag_number;

                return (
                  <TableRow
                    key={cow.cattle_id}
                    ref={virtualizer.measureElement}
                    data-index={index}
                    id={`feeding-row-${cow.cattle_id}`}
                    className={cn(
                      "align-top transition-colors hover:bg-muted/40",
                      "max-md:grid max-md:grid-cols-[auto_minmax(0,1fr)_auto] max-md:items-center max-md:gap-x-3 max-md:gap-y-3 max-md:rounded-xl max-md:border max-md:border-border max-md:bg-card max-md:p-3 max-md:shadow-xs",
                      isSelected && "bg-primary/[0.04] max-md:border-primary/40",
                    )}
                  >
                    <TableCell className="pt-4 text-center max-md:p-0">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggle(cow.cattle_id)}
                        aria-label={t("selectCow", { name: cowName })}
                      />
                    </TableCell>

                    <TableCell className="pt-3.5 max-md:min-w-0 max-md:whitespace-normal max-md:p-0">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {(cow.name?.[0] ?? cow.tag_number?.[0] ?? "C").toUpperCase()}
                        </div>
                        <div className="flex min-w-0 flex-col">
                          <AnimalLink
                            id={cow.cattle_id}
                            animalName={cow.name}
                            tagNumber={cow.tag_number}
                            className="truncate text-sm font-semibold text-foreground transition-colors hover:text-primary"
                          >
                            {cowName}
                          </AnimalLink>
                          <span className="truncate font-mono text-xs text-muted-foreground">{cow.tag_number}</span>
                          {fed ? (
                            <span className="mt-0.5 text-xs font-medium text-success">
                              {tu("fedToday", { kg: cow.confirmed_offered_kg ?? 0 })}
                            </span>
                          ) : null}
                          {cow.program_conflict ? (
                            <span className="mt-0.5 flex items-center gap-1 text-xs text-warning">
                              <AlertTriangle className="size-3" aria-hidden />
                              {tp("conflict")}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="py-2.5 max-md:col-span-full max-md:whitespace-normal max-md:p-0">
                      <FeedLineCell
                        cowName={cowName}
                        rowIndex={index}
                        total={cowTotalKg(rowLines)}
                        lines={rowLines}
                        rowSelected={isSelected}
                        stock={stock}
                        usage={usage}
                        preparedOptions={preparedOptions}
                        onChangeKg={(key, kg) => changeKg(cow.cattle_id, key, kg)}
                        onRemove={(key) => removeLine(cow.cattle_id, key)}
                        onRemoveAll={() => removeAllLines(cow.cattle_id)}
                        onAdd={(source, name) => addLine(cow.cattle_id, source, name)}
                        onToggleSource={(source, name) => toggleSource(cow.cattle_id, source, name)}
                        onSelectPlan={(plan) => applyPlanToCow(cow.cattle_id, plan)}
                        onTouch={() => ensureSelected(cow.cattle_id)}
                      />
                    </TableCell>

                      <TableCell className="pt-2.5 max-md:col-span-full max-md:flex max-md:items-center max-md:justify-between max-md:gap-3 max-md:p-0">
                        <span className="shrink-0 text-xs font-semibold text-muted-foreground md:hidden">{t("columns.refusal")}</span>
                        <div className="flex h-8.5 w-24 items-center rounded-lg border border-input/80 bg-background px-2.5 shadow-2xs transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 hover:border-input">
                          <input
                            type="number"
                            min={0}
                            step={0.1}
                            placeholder="0"
                            value={refusals[cow.cattle_id] ?? ""}
                            data-grid-input="refusal"
                            data-row-index={index}
                            aria-label={tp("refusalFor", { animal: cowName })}
                            onChange={(e) => {
                              ensureSelected(cow.cattle_id);
                              setRefusals((p) => ({ ...p, [cow.cattle_id]: e.target.value }));
                            }}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => {
                              if (e.key !== "Enter") return;
                              e.preventDefault();
                              const allInputs = Array.from(
                                document.querySelectorAll<HTMLInputElement>(
                                  'input[data-grid-input="refusal"]:not([disabled])',
                                ),
                              );
                              const currentIndex = allInputs.indexOf(e.currentTarget);
                              if (currentIndex === -1) return;
                              const target = allInputs[e.shiftKey ? currentIndex - 1 : currentIndex + 1];
                              if (target) {
                                target.focus();
                                target.select();
                              }
                            }}
                            className="h-full w-full min-w-0 bg-transparent p-0 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/30 [appearance:textfield] disabled:cursor-not-allowed [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                          <span className="ml-1 shrink-0 text-xs font-medium text-muted-foreground/70">kg</span>
                        </div>
                      </TableCell>

                      <TableCell className="pt-3.5 max-md:col-span-full max-md:flex max-md:items-center max-md:justify-between max-md:gap-3 max-md:whitespace-normal max-md:p-0">
                        <span className="shrink-0 text-xs font-semibold text-muted-foreground md:hidden">{tp("fit.title")}</span>
                        {(() => {
                          // No requirement or no server fit (a cow on no program has neither) → nothing to compare to.
                          if (!cow.requirement || !cow.fit) return <FitPill fit={cow.fit} requirement={cow.requirement} supply={cow.planned_supply} cattleId={cow.cattle_id} />;
                          const supply = liveSupply(rowLines, densityFor);
                          // Fed already today → judge the row against what she STILL needs, and show that figure.
                          const fedSoFar = fed ? cow.confirmed_supply : null;
                          return (
                            <FitPill
                              fit={liveFit(supply, cow.requirement, bands, cow.fit.estimated || (fedSoFar ? !fedSoFar.complete : false), fedSoFar)}
                              requirement={remainingRequirement(cow.requirement, fedSoFar)}
                              supply={supply}
                              cattleId={cow.cattle_id}
                            />
                          );
                        })()}
                      </TableCell>

                      <TableCell className="pt-3.5 max-md:col-span-full max-md:flex max-md:items-center max-md:justify-between max-md:gap-3 max-md:whitespace-normal max-md:p-0">
                        <span className="shrink-0 text-xs font-semibold text-muted-foreground md:hidden">{t("columns.requirement")}</span>
                        <RequirementProgress
                          progress={requirementProgress(cow.confirmed_supply ?? { dm_kg: 0, cp_kg: 0, me_mj: 0 }, cow.requirement)}
                        />
                      </TableCell>

                      <TableCell className="pt-2.5 text-center max-md:col-start-3 max-md:row-start-1 max-md:p-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7 shrink-0 text-muted-foreground hover:text-primary"
                              aria-label={t("cowHistory.openButton", { name: cowName })}
                              onClick={() => setHistoryCow({ id: cow.cattle_id, name: cowName })}
                            >
                              <History className="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t("cowHistory.openButton", { name: cowName })}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                );
              })}
              {padBottom > 0 ? <TableSpacer height={padBottom} /> : null}
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLUMN_COUNT} className="py-8 text-center max-md:block text-sm text-muted-foreground">
                    {t("noItemsFound")}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
        </>
      )}

      {/* Sticky summary + actions */}
      <Can I="feed.distribution-log">
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/95 p-3 sm:p-4 shadow-lg backdrop-blur">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="size-2 rounded-full bg-primary" />
              {t("summary.selectedCount", { count: selectedIds.length, total: ordered.length })}
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="font-semibold text-foreground">{t("summary.totalOffered", { total: totalKg.toFixed(1) })}</div>
          </div>
          <div className="flex w-full items-center gap-2.5 sm:w-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  disabled={pending || !canSubmit}
                  onClick={() => void run("save")}
                  className="min-w-0 flex-1 px-3 font-medium shadow-2xs sm:flex-none sm:px-4"
                >
                  {saveDraft.isPending ? t("saving") : t("summary.saveDraft")}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("draftHint")}</TooltipContent>
            </Tooltip>
            <Button
              disabled={pending || !canSubmit}
              onClick={() => setConfirmOpen(true)}
              className="min-w-0 flex-1 gap-1.5 px-3 font-medium shadow-2xs sm:flex-none sm:px-4"
            >
              <Check className="size-4 shrink-0" />
              <span className="truncate">
                {confirmProgram.isPending ? t("confirming") : t("summary.confirmFeeding", { count: selectedIds.length })}
              </span>
            </Button>
          </div>
        </div>
      </Can>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("confirmDialog.title")}
        description={t("confirmDialog.description", { count: selectedIds.length, kg: Math.round(totalKg * 10) / 10 })}
        confirmLabel={t("confirmDialog.confirm")}
        variant="primary"
        onConfirm={() => run("confirm")}
      />

      <ApplyPlanDialog
        target={applyTarget}
        presetCows={applyCows}
        onOpenChange={(open) => {
          if (open) return;
          setApplyTarget(null);
          // Reload only after the dialog's "done" summary was seen — remounting the grid earlier would close it.
          if (appliedRef.current) {
            appliedRef.current = false;
            void onPersisted();
          }
        }}
        onApplied={() => {
          appliedRef.current = true;
        }}
      />

      <FeedItemFormDialog
        open={addFeedItemOpen}
        onOpenChange={setAddFeedItemOpen}
        onCreated={(item) => setBulkSources([{ sourceType: "FEED_ITEM", itemId: item.id }])}
      />
      <CreateFeedDialog open={createOpen} onOpenChange={setCreateOpen} kind={createKind} />

      <FeedingCowHistorySheet
        key={historyCow?.id ?? "none"}
        cattleId={historyCow?.id ?? null}
        cattleName={historyCow?.name ?? null}
        initialDate={date}
        onOpenChange={(next) => {
          if (!next) setHistoryCow(null);
        }}
      />
    </>
  );
}
