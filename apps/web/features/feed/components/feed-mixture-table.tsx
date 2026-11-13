"use client"; // per-keystroke live totals

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays, Package, Wheat, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rakhal/ui/ui/table";
import { MoneyText } from "@/components/shared/money-text";
import type { FeedIngredient } from "../types";
import {
  balanceScore,
  balanceScoreBand,
  computeTotals,
  type EffectiveIngredientNutrition,
  type FormulaLine,
  type FormulaTotals,
  type ItemContribution,
  type Requirements,
} from "../lib/formula-math";
import type { CreateFeedFormItem } from "../schemas";
import { formLineKey, itemStockKg, kgPerUnit } from "../lib/recipe-line";
import { Chip } from "@/components/ui/chip";
import type { BatchLink } from "./batch-link-picker";
import { useFeedStock } from "../hooks/use-feed";
import { useFeedItemPagedList } from "@/features/inventory/hooks/use-inventory";

export function toEffectiveMap(ingredients: FeedIngredient[]): Map<string, EffectiveIngredientNutrition> {
  return new Map(
    ingredients.map((ing) => [
      ing.id,
      {
        dmPct: ing.nutrition.dm_pct,
        cpPct: ing.nutrition.cp_pct,
        meMjPerKgDm: ing.nutrition.me_mj_per_kg_dm,
        fatPct: ing.nutrition.fat_pct,
        ndfPct: ing.nutrition.ndf_pct,
        rdpPct: ing.nutrition.rdp_pct,
        rupPct: ing.nutrition.rup_pct,
        starchPct: ing.nutrition.starch_pct,
        adfPct: ing.nutrition.adf_pct,
        calciumPct: ing.nutrition.calcium_pct,
        phosphorusPct: ing.nutrition.phosphorus_pct,
        tdnPct: ing.nutrition.tdn_pct,
        pricePerKg: ing.effective_price_per_kg,
      },
    ]),
  );
}

/** Keeps its own text so the field can be emptied. Capped to max available stock if inventory-backed. */
function AmountInput({
  value,
  max,
  onChange,
}: {
  value: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState(value === 0 ? "" : String(value));
  const t = useTranslations("feed");
  // Resync during render (not in an effect) when the parent's value diverges from what the text means.
  if ((Number(text) || 0) !== value) setText(value === 0 ? "" : String(value));

  const isExceeded = max != null && value > max;

  return (
    <div className="flex flex-col gap-0.5">
      <input
        type="number"
        inputMode="decimal"
        min={0}
        max={max}
        step="0.01"
        data-amount-input
        placeholder="0"
        value={text}
        onChange={(e) => {
          const raw = e.target.value;
          let num = Number(raw) || 0;
          if (max != null && num > max) {
            num = max;
            setText(String(max));
            toast.warning(t("exceedsStockWarning", { stock: max }));
          } else {
            setText(raw);
          }
          onChange(num);
        }}
        onFocus={(e) => e.currentTarget.select()}
        className={cn(
          "w-full border-0 bg-transparent p-0 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
          isExceeded && "text-destructive font-semibold",
        )}
      />
      {max != null ? (
        <span
          className={cn(
            "text-xs leading-tight",
            isExceeded ? "text-destructive font-medium" : "text-muted-foreground",
          )}
        >
          {t("stockLimit", { stock: numberFmt(max) })}
        </span>
      ) : null}
    </div>
  );
}

const numberFmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));

/** Per-line cell: the computed kg/mj contribution plus the ingredient's own raw nutrient rate
 * (its fixed DM%/CP%/Fat%/NDF% or ME MJ/kg-DM) as a small annotation underneath — user request
 * 2026-07-17: "how much % DM does Napier grass have, and how much kg does that turn into at the
 * amount added". The computed value already answers the kg question; `rate` answers the %/rate one. */
function NutrientCell({ value, rate, toneClass }: { value: number; rate: string | null; toneClass: string }) {
  return (
    <TableCell className={cn("text-center", toneClass)}>
      <div className="flex flex-col items-center leading-tight">
        <span>{numberFmt(value)}</span>
        {rate != null ? <span className="text-xs text-muted-foreground">{rate}</span> : null}
      </div>
    </TableCell>
  );
}

/** Column group definitions — order and grouping match the user's reference spreadsheet (2026-07-17
 * follow-up): Protein (CP/RDP/RUP), Energy (ME/FAT/Starch/TDN), Fibers (NDF/ADF), Minerals (Calcium/
 * Phosphorus). Only DM/CP/ME/Fat/NDF have a real per-cow requirement (`requirements.ts` has no
 * target for the other 7 — flagged, not fabricated) so `hasRequirement` gates the tinted comparison
 * on the Daily Total Requirement row; uncovered nutrients show a plain `—` there instead. */
const NUTRIENT_COLUMNS = [
  { key: "cpKg", rateKey: "cpPct", labelKey: "cpKg", group: "protein", hasRequirement: true, unit: "%" },
  { key: "rdpKg", rateKey: "rdpPct", labelKey: "rdpKg", group: "protein", hasRequirement: false, unit: "%" },
  { key: "rupKg", rateKey: "rupPct", labelKey: "rupKg", group: "protein", hasRequirement: false, unit: "%" },
  { key: "meMj", rateKey: "meMjPerKgDm", labelKey: "meMj", group: "energy", hasRequirement: true, unit: "MJ/kgDM" },
  { key: "fatKg", rateKey: "fatPct", labelKey: "fatKg", group: "energy", hasRequirement: true, unit: "%" },
  { key: "starchKg", rateKey: "starchPct", labelKey: "starchKg", group: "energy", hasRequirement: false, unit: "%" },
  { key: "tdnKg", rateKey: "tdnPct", labelKey: "tdnKg", group: "energy", hasRequirement: false, unit: "%" },
  { key: "ndfKg", rateKey: "ndfPct", labelKey: "ndfKg", group: "fibers", hasRequirement: true, unit: "%" },
  { key: "adfKg", rateKey: "adfPct", labelKey: "adfKg", group: "fibers", hasRequirement: false, unit: "%" },
  { key: "calciumKg", rateKey: "calciumPct", labelKey: "calciumKg", group: "minerals", hasRequirement: false, unit: "%" },
  { key: "phosphorusKg", rateKey: "phosphorusPct", labelKey: "phosphorusKg", group: "minerals", hasRequirement: false, unit: "%" },
] as const;

const GROUP_STYLES = {
  protein: { bg: "bg-info-tint", text: "text-info" },
  energy: { bg: "bg-warning-tint", text: "text-warning" },
  fibers: { bg: "bg-success-tint", text: "text-success" },
  minerals: { bg: "bg-accent-purple-tint", text: "text-accent-purple" },
} as const;

const GROUP_ORDER = ["protein", "energy", "fibers", "minerals"] as const;

/**
 * "Total Mixed Ration (TMR)" ingredient table (Figma `1065:35817` for the base layout; extended 2026-07-17
 * follow-up to show all 12 nutrients the backend computes, per the user's own reference
 * spreadsheet — no Figma frame exists for the wider table, built with the same column/tint pattern
 * as the original 5). Ingredient Name/Amount/DM columns + Protein (CP/RDP/RUP) + Energy (ME/FAT/
 * Starch/TDN) + Fibers (NDF/ADF) + Minerals (Calcium/Phosphorus) + Cost, followed by Total Feed
 * Amount / Daily Total Amount (per cow) / Daily Total Requirement rows. Only DM/CP/ME/Fat/NDF have a
 * real per-cow requirement target (`requirements.ts`) — those cells in the last row are tinted
 * success/destructive by whether the daily amount meets it; the other 7 nutrients show a plain
 * value with no comparison (no requirement formula exists for them yet, see `NUTRIENT_COLUMNS`).
 * Wrapped in a horizontally-scrolling container since 12 nutrient pairs + name/amount/cost don't
 * fit a card-width table.
 *
 * Supports batch duration (number of days) multiplication — when preparing feed for multiple days,
 * daily amounts are adjusted to meet per-cow daily requirements and multiplied by the batch days
 * to show the total feed quantity to prepare, total DM, total nutrient contributions, and total cost.
 */
export function FeedMixtureTable({
  items,
  effectiveById,
  requirements,
  cowCount,
  durationDays = 1,
  onDurationDaysChange,
  onAmountChange,
  onRemove,
  onBatchLinkChange,
  readOnly = false,
  showPerCow = true,
  serverContributions,
  serverTotals,
}: {
  items: CreateFeedFormItem[];
  effectiveById: Map<string, EffectiveIngredientNutrition>;
  requirements: Requirements | null;
  /** Number of animals the formula is fed to — real `assigned_count` for a Group target, 1 for
   * Individual — used to divide Total Feed Amount into a real per-cow daily figure. */
  cowCount: number;
  /** Batch duration in days — multiplies daily amounts and totals for multi-day batch production. */
  durationDays?: number;
  onDurationDaysChange?: (days: number) => void;
  onAmountChange?: (lineKey: string, amountKg: number) => void;
  onRemove?: (lineKey: string) => void;
  /** RAKHAL-422/RFE-112 — per-line inventory-batch link callback. Omitted (as the read-only detail
   * sheet does) hides the `BatchLinkPicker` entirely rather than rendering a disabled control. */
  onBatchLinkChange?: (lineKey: string, link: BatchLink | undefined, lotEffective?: EffectiveIngredientNutrition) => void;
  readOnly?: boolean;
  /** A Concentrate Mixer has no cow/group target at all (see `concentration-card.tsx`'s doc comment)
   * so a "per cow" daily figure is meaningless for it — `cowCount` would otherwise silently default
   * to 1, making this row a no-op duplicate of "Total Feed Amount" (user report 2026-07-19). Callers
   * pass `false` for a `CONCENTRATE_TEMPLATE`; a `FEED_MIXTURE` always has a real target, so it
   * defaults `true`. */
  showPerCow?: boolean;
  /** Already-computed per-line/total figures straight from `GET /feed/concentrations/:id` (the
   * detail sheet) — used instead of the live client-side formula-math preview, which needs each
   * ingredient's effective nutrition (not fetched for a read-only view). */
  serverContributions?: ItemContribution[];
  serverTotals?: FormulaTotals;
}) {
  const t = useTranslations("feed.table");
  const tFeed = useTranslations("feed");

  const [internalDays, setInternalDays] = useState<number>(durationDays > 0 ? durationDays : 1);
  const effectiveDays = onDurationDaysChange ? Math.max(1, durationDays || 1) : Math.max(1, internalDays);

  function handleDaysChange(newDays: number) {
    const val = Math.max(1, Math.min(365, newDays));
    if (onDurationDaysChange) {
      onDurationDaysChange(val);
    } else {
      setInternalDays(val);
    }
  }

  const lines: FormulaLine[] = useMemo(
    () => items.map((i) => ({ ingredientId: formLineKey(i), amountKg: i.amountKg })),
    [items],
  );
  const computed = useMemo(() => computeTotals(lines, effectiveById), [lines, effectiveById]);
  const contributions = serverContributions ?? computed.items;
  const totals = serverTotals ?? computed.totals;
  const contributionById = useMemo(() => new Map(contributions.map((c) => [c.ingredientId, c])), [contributions]);

  /** Raw summed kg across every line — e.g. two 50kg lines = 100kg. */
  const totalAmountKg = useMemo(() => items.reduce((sum, i) => sum + i.amountKg, 0), [items]);

  /** DM as a % of the *mix's* total kg (not an ingredient's own fixed DM% rate, which is a different
   * number shown per-line) — e.g. 7kg DM out of 100kg total feed = 7%. Only meaningful on the totals
   * rows, where "amount" means the whole mix rather than one ingredient. */
  function dmPctOf(dmKg: number, amountKg: number) {
    return amountKg > 0 ? (dmKg / amountKg) * 100 : 0;
  }

  /** A nutrient's overall concentration in the mix, on a DM basis (e.g. mix CP% = total CP kg ÷ total
   * DM kg × 100). */
  function totalsRate(col: (typeof NUTRIENT_COLUMNS)[number], nutrientTotal: number, dmKg: number) {
    if (col.unit !== "%") return dmKg > 0 ? `${numberFmt(nutrientTotal / dmKg)} ${col.unit}` : null;
    return `${numberFmt(dmKg > 0 ? (nutrientTotal / dmKg) * 100 : 0)}%`;
  }

  const dailyTotals = useMemo(() => {
    const divisor = cowCount > 0 ? cowCount : 1;
    const out = {} as Record<(typeof NUTRIENT_COLUMNS)[number]["key"] | "dmKg" | "amountKg" | "costTk", number>;
    out.amountKg = totalAmountKg / divisor;
    out.dmKg = totals.dmKg / divisor;
    out.costTk = totals.totalCostTk / divisor;
    for (const col of NUTRIENT_COLUMNS) out[col.key] = totals[col.key] / divisor;
    return out;
  }, [totals, cowCount, totalAmountKg]);

  const feedItemsQuery = useFeedItemPagedList({});
  const feedStockQuery = useFeedStock();

  const inventoryStockMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const fi of feedItemsQuery.items ?? []) {
      map.set(fi.id, itemStockKg(fi));
      for (const batch of fi.batches ?? []) {
        if (batch.currentStock != null) {
          const kg = kgPerUnit(fi);
          map.set(`${fi.id}:${batch.id}`, kg && kg > 0 ? batch.currentStock * kg : batch.currentStock);
        }
      }
    }
    for (const s of feedStockQuery.data ?? []) {
      map.set(s.id, s.current_stock_kg);
    }
    return map;
  }, [feedItemsQuery.items, feedStockQuery.data]);

  const score = requirements ? balanceScore(totals, requirements) : null;
  const band = score != null ? balanceScoreBand(score) : null;

  function cellTone(actual: number, required: number | undefined) {
    if (required == null || required <= 0) return undefined;
    if (actual < required * 0.98) return "bg-destructive-tint text-destructive font-semibold";
    if (actual <= required * 1.05) return "bg-success-tint text-success font-semibold";
    return "bg-warning-tint text-warning font-semibold";
  }

  const groupCounts = GROUP_ORDER.map((g) => ({
    group: g,
    count: NUTRIENT_COLUMNS.filter((c) => c.group === g).length,
  })).filter((g) => g.count > 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Batch Duration / Multiplier Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <CalendarDays className="size-4 text-primary shrink-0" aria-hidden />
            <span>{t("makingForDays")}:</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center rounded-lg border border-input bg-background px-2.5 py-1 shadow-2xs focus-within:ring-2 focus-within:ring-primary/20">
              <input
                type="number"
                min={1}
                max={365}
                value={effectiveDays}
                onChange={(e) => {
                  const num = parseInt(e.target.value, 10);
                  if (!isNaN(num) && num >= 1) handleDaysChange(num);
                }}
                disabled={readOnly && !onDurationDaysChange}
                className="w-12 bg-transparent text-center text-sm font-bold text-foreground outline-none"
              />
              <span className="text-xs font-medium text-muted-foreground pr-1">
                {t("daysLabel", { count: effectiveDays })}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {[1, 3, 7, 14, 30].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleDaysChange(preset)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                    effectiveDays === preset
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "border border-border/80 bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {preset === 1 ? t("dayOption1") : `${preset}d`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {effectiveDays > 1 ? (
          <div className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <span>{t("multiplierHint", { days: effectiveDays })}</span>
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead rowSpan={2} className="align-middle">
                  {t("ingredientName")}
                </TableHead>
                <TableHead rowSpan={2} className="align-middle">
                  {t("amount")}
                </TableHead>
                <TableHead rowSpan={2} className="text-center align-middle">
                  {t("dmKg")}
                </TableHead>
                {groupCounts.map(({ group, count }) => (
                  <TableHead
                    key={group}
                    colSpan={count}
                    className={cn("text-center", GROUP_STYLES[group].bg, GROUP_STYLES[group].text)}
                  >
                    {t(group)}
                  </TableHead>
                ))}
                <TableHead rowSpan={2} className="text-center align-middle">
                  {t("cost")}
                </TableHead>
                {!readOnly ? <TableHead rowSpan={2} className="w-10" /> : null}
              </TableRow>
              <TableRow className="bg-muted hover:bg-muted">
                {NUTRIENT_COLUMNS.map((col) => (
                  <TableHead
                    key={col.key}
                    className={cn(
                      "text-center text-xs font-medium normal-case text-muted-foreground",
                      GROUP_STYLES[col.group].bg,
                    )}
                  >
                    {t(col.labelKey)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const lineKey = formLineKey(item);
                const c = contributionById.get(lineKey);
                const eff = effectiveById.get(lineKey);

                const isInventory = Boolean(item.feedItemId || item.feedStockId);
                const stockKey = item.feedItemId
                  ? item.feedItemBatchId
                    ? `${item.feedItemId}:${item.feedItemBatchId}`
                    : item.feedItemId
                  : (item.feedStockId ?? "");
                const maxStockKg = isInventory ? (inventoryStockMap.get(stockKey) ?? item.availableStockKg ?? null) : null;
                const batchNeededKg = item.amountKg * effectiveDays;
                const isBatchExceeded = maxStockKg != null && batchNeededKg > maxStockKg;

                return (
                  <TableRow key={lineKey}>
                    <TableCell className="font-medium text-foreground">
                      <div className="flex flex-col gap-1">
                        <span className="truncate">{item.ingredientName}</span>
                        {isInventory ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Chip variant="teal" className="w-fit px-1.5 py-0 text-xs font-medium gap-1">
                              <Package className="size-2.5 shrink-0" aria-hidden />
                              {tFeed("sourceInventory")}
                            </Chip>
                            {maxStockKg != null ? (
                              <span
                                className={cn(
                                  "text-xs font-medium",
                                  maxStockKg <= 0 || isBatchExceeded ? "text-destructive" : "text-muted-foreground",
                                )}
                              >
                                {maxStockKg > 0 ? tFeed("stockAmount", { stock: numberFmt(maxStockKg) }) : tFeed("outOfStockBadge")}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <Chip variant="info" className="w-fit px-1.5 py-0 text-xs font-medium gap-1">
                            <Wheat className="size-2.5 shrink-0" aria-hidden />
                            {tFeed("sourceCatalogue")}
                          </Chip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {readOnly ? (
                        <div className="flex flex-col gap-0.5">
                          <span>
                            {numberFmt(item.amountKg)} <span className="text-xs text-muted-foreground">kg/day</span>
                          </span>
                          {effectiveDays > 1 ? (
                            <span className="text-xs font-semibold text-primary">
                              {t("itemBatchTotal", { days: effectiveDays, amount: numberFmt(batchNeededKg) })}
                            </span>
                          ) : null}
                          {isBatchExceeded ? (
                            <span className="text-xs text-destructive font-medium">
                              {t("batchStockWarning", { days: effectiveDays, stock: numberFmt(maxStockKg), needed: numberFmt(batchNeededKg) })}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <div
                            className={cn(
                              "flex min-h-9 w-28 items-center gap-1 rounded-lg bg-card px-2 py-1 shadow-xs border",
                              isBatchExceeded ? "border-destructive ring-1 ring-destructive/40" : "border-border/60",
                            )}
                          >
                            <AmountInput
                              value={item.amountKg}
                              max={maxStockKg != null && effectiveDays > 1 ? maxStockKg / effectiveDays : (maxStockKg ?? undefined)}
                              onChange={(v) => onAmountChange?.(lineKey, v)}
                            />
                            <span className="text-xs text-muted-foreground shrink-0 self-center">kg</span>
                          </div>
                          {effectiveDays > 1 ? (
                            <span className="text-xs font-semibold text-primary leading-tight">
                              {t("itemBatchTotal", { days: effectiveDays, amount: numberFmt(batchNeededKg) })}
                            </span>
                          ) : null}
                          {isBatchExceeded ? (
                            <span className="text-xs text-destructive font-medium leading-tight">
                              {t("batchStockWarning", { days: effectiveDays, stock: numberFmt(maxStockKg), needed: numberFmt(batchNeededKg) })}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </TableCell>
                    <NutrientCell value={c?.dmKg ?? 0} rate={eff ? `${numberFmt(eff.dmPct)}%` : null} toneClass="" />
                    {NUTRIENT_COLUMNS.map((col) => {
                      const rate = eff?.[col.rateKey] ?? null;
                      return (
                        <NutrientCell
                          key={col.key}
                          value={c?.[col.key] ?? 0}
                          rate={rate != null ? `${numberFmt(rate)}${col.unit === "%" ? "%" : ` ${col.unit}`}` : null}
                          toneClass={GROUP_STYLES[col.group].text}
                        />
                      );
                    })}
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center">
                        <MoneyText amount={c?.costTk ?? 0} />
                        {effectiveDays > 1 ? (
                          <span className="text-xs font-semibold text-primary">
                            <MoneyText amount={(c?.costTk ?? 0) * effectiveDays} />
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    {!readOnly ? (
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => onRemove?.(lineKey)}
                          aria-label={t("removeItem")}
                          className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive-tint hover:text-destructive"
                        >
                          <X className="size-3.5" aria-hidden />
                        </button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}

              {/* Daily Total Amount Row */}
              <TableRow className="bg-muted/60 font-medium hover:bg-muted/60">
                <TableCell>
                  <p className="text-foreground">{t("dailyTotalAmount")}</p>
                  <p className="text-xs font-normal text-muted-foreground">
                    {showPerCow ? t("dailyAmountSubtext") : t("dailyAmountFormulaSubtext")}
                  </p>
                </TableCell>
                <TableCell className="text-center">
                  {numberFmt(dailyTotals.amountKg)} <span className="text-xs font-normal text-muted-foreground">kg</span>
                </TableCell>
                <NutrientCell
                  value={dailyTotals.dmKg}
                  rate={`${numberFmt(dmPctOf(dailyTotals.dmKg, dailyTotals.amountKg))}%`}
                  toneClass=""
                />
                {NUTRIENT_COLUMNS.map((col) => (
                  <NutrientCell
                    key={col.key}
                    value={dailyTotals[col.key]}
                    rate={totalsRate(col, dailyTotals[col.key], dailyTotals.dmKg)}
                    toneClass={GROUP_STYLES[col.group].text}
                  />
                ))}
                <TableCell className="text-center">
                  <MoneyText amount={dailyTotals.costTk} />
                </TableCell>
                {!readOnly ? <TableCell /> : null}
              </TableRow>

              {/* Daily Total Requirement Row (TMR only) */}
              {showPerCow && requirements ? (
                <TableRow className="font-medium hover:bg-transparent">
                  <TableCell colSpan={2}>
                    <p className="text-foreground">{t("dailyTotalRequirement")}</p>
                    <p className="text-xs font-normal text-muted-foreground">{t("perCow")}</p>
                  </TableCell>
                  <TableCell className={cn("text-center", cellTone(dailyTotals.dmKg, requirements.dmKg))}>
                    {numberFmt(requirements.dmKg)}
                  </TableCell>
                  {NUTRIENT_COLUMNS.map((col) =>
                    col.hasRequirement ? (
                      <TableCell
                        key={col.key}
                        className={cn(
                          "text-center",
                          cellTone(dailyTotals[col.key], requirements[col.key as keyof Requirements]),
                        )}
                      >
                        {numberFmt(requirements[col.key as keyof Requirements] as number)}
                      </TableCell>
                    ) : (
                      <TableCell key={col.key} className="text-center">
                        —
                      </TableCell>
                    ),
                  )}
                  <TableCell className="text-center">—</TableCell>
                  {!readOnly ? <TableCell /> : null}
                </TableRow>
              ) : null}

              {/* Multiplied Batch Total Row (when durationDays > 1) */}
              {effectiveDays > 1 ? (
                <TableRow className="bg-primary/10 font-bold hover:bg-primary/15 border-t-2 border-primary/30">
                  <TableCell>
                    <p className="text-foreground font-bold">{t("totalBatchAmount", { days: effectiveDays })}</p>
                    <p className="text-xs font-normal text-muted-foreground">
                      {t("batchQuantitySubtext", { days: effectiveDays })}
                    </p>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-base font-bold text-primary">{numberFmt(totalAmountKg * effectiveDays)}</span>{" "}
                    <span className="text-xs font-normal text-muted-foreground">kg</span>
                  </TableCell>
                  <NutrientCell
                    value={totals.dmKg * effectiveDays}
                    rate={`${numberFmt(dmPctOf(totals.dmKg, totalAmountKg))}%`}
                    toneClass="font-bold text-foreground"
                  />
                  {NUTRIENT_COLUMNS.map((col) => (
                    <NutrientCell
                      key={col.key}
                      value={totals[col.key] * effectiveDays}
                      rate={totalsRate(col, totals[col.key], totals.dmKg)}
                      toneClass={cn(GROUP_STYLES[col.group].text, "font-bold")}
                    />
                  ))}
                  <TableCell className="text-center font-bold text-primary text-base">
                    <MoneyText amount={totals.totalCostTk * effectiveDays} />
                  </TableCell>
                  {!readOnly ? <TableCell /> : null}
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </div>

      {requirements ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground px-1">
          <div className="flex items-center gap-3">
            <span className="font-medium text-foreground">{tFeed("requirementsLegend")}:</span>
            <span className="inline-flex items-center gap-1 text-xs">
              <span className="size-2 rounded-full bg-destructive" />
              {tFeed("legendNotMet")}
            </span>
            <span className="inline-flex items-center gap-1 text-xs">
              <span className="size-2 rounded-full bg-success" />
              {tFeed("legendMet")}
            </span>
            <span className="inline-flex items-center gap-1 text-xs">
              <span className="size-2 rounded-full bg-warning" />
              {tFeed("legendExceeded")}
            </span>
          </div>
        </div>
      ) : null}

      {score != null && band ? (
        <div className="flex items-center gap-4">
          <p className="shrink-0 text-sm font-medium text-foreground">{t("feedMixture")}</p>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                band === "success" ? "bg-success" : band === "warning" ? "bg-warning" : "bg-destructive",
              )}
              style={{ width: `${Math.min(score, 100)}%` }}
            />
          </div>
          <p
            className={cn(
              "shrink-0 text-sm font-medium",
              band === "success" ? "text-success" : band === "warning" ? "text-warning" : "text-destructive",
            )}
          >
            {t("percentCompleted", { score })}
          </p>
        </div>
      ) : null}
    </div>
  );
}
