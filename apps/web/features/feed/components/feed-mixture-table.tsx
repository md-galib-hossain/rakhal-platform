"use client"; // per-keystroke live totals

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
        {rate != null ? <span className="text-[11px] text-muted-foreground">{rate}</span> : null}
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
 * The "Total Feed Amount" and "Daily Total Amount" rows show a %-of-DM rate sub-label under every
 * nutrient column, not just DM (2026-07-18 follow-up: "why not for other columns") — the mix's own
 * overall CP%/ME-per-kg-DM/etc. concentration (`pctOfDm`), distinct from a per-line ingredient's fixed
 * rate. "Daily Total Amount"'s Cost cell now shows a real per-cow figure (`totals.totalCostTk` ÷
 * `cowCount`) instead of a hardcoded `—` — it was never computed before, a real gap, not the
 * intentional-`—` pattern the Requirement row still correctly uses for the 7 nutrients with no target
 * formula.
 */
export function FeedMixtureTable({
  items,
  effectiveById,
  requirements,
  cowCount,
  onAmountChange,
  onRemove,
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
  onAmountChange?: (ingredientId: string, amountKg: number) => void;
  onRemove?: (ingredientId: string) => void;
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

  const lines: FormulaLine[] = useMemo(
    () => items.map((i) => ({ ingredientId: i.ingredientId, amountKg: i.amountKg })),
    [items],
  );
  const computed = useMemo(() => computeTotals(lines, effectiveById), [lines, effectiveById]);
  const contributions = serverContributions ?? computed.items;
  const totals = serverTotals ?? computed.totals;
  const contributionById = useMemo(() => new Map(contributions.map((c) => [c.ingredientId, c])), [contributions]);

  /** Raw summed kg across every line — e.g. two 50kg lines = 100kg. Previously computed nowhere:
   * the Total Feed Amount row's label cell spanned straight over the Amount column (`colSpan={2}`),
   * so this figure never actually rendered anywhere (user request 2026-07-18). */
  const totalAmountKg = useMemo(() => items.reduce((sum, i) => sum + i.amountKg, 0), [items]);

  /** DM as a % of the *mix's* total kg (not an ingredient's own fixed DM% rate, which is a different
   * number shown per-line) — e.g. 7kg DM out of 100kg total feed = 7%. Only meaningful on the totals
   * rows, where "amount" means the whole mix rather than one ingredient. */
  function dmPctOf(dmKg: number, amountKg: number) {
    return amountKg > 0 ? (dmKg / amountKg) * 100 : 0;
  }

  /** A nutrient's overall concentration in the mix, on a DM basis (e.g. mix CP% = total CP kg ÷ total
   * DM kg × 100) — same convention the user's reference spreadsheet pairs with every kg figure.
   * Mirrors the per-line rate (`eff.cpPct` etc.) but computed for the *whole mix* instead of one
   * ingredient, since a totals row has no single ingredient's fixed rate to show (user request
   * 2026-07-18: "why not for other columns"). **ME is not kg-based** (`meMj` is megajoules, not a
   * mass) — dividing it by DM kg and labeling the result "%" is nonsensical (caught live: a 44kg-DM
   * mix with 594 MJ ME rendered "1350%"). ME's rate must stay energy-density (MJ per kg DM), matching
   * its per-line rate (`eff.meMjPerKgDm`) and its column's own declared `unit` — every other column's
   * `unit` is `"%"`, so this only branches for the one exception. */
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

  const score = requirements ? balanceScore(totals, requirements) : null;
  const band = score != null ? balanceScoreBand(score) : null;

  function cellTone(actual: number, required: number | undefined) {
    if (required == null) return undefined;
    return actual >= required ? "bg-success-tint" : "bg-destructive-tint";
  }

  const groupCounts = GROUP_ORDER.map((g) => ({
    group: g,
    count: NUTRIENT_COLUMNS.filter((c) => c.group === g).length,
  })).filter((g) => g.count > 0);

  return (
    <div className="flex flex-col gap-4">
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
                const c = contributionById.get(item.ingredientId);
                const eff = effectiveById.get(item.ingredientId);
                return (
                  <TableRow key={item.ingredientId}>
                    <TableCell className="font-medium text-foreground">{item.ingredientName}</TableCell>
                    <TableCell>
                      {readOnly ? (
                        <span>
                          {numberFmt(item.amountKg)} <span className="text-xs text-muted-foreground">kg</span>
                        </span>
                      ) : (
                        <div className="flex h-9 w-28 items-center gap-1 rounded-lg bg-card px-2 shadow-xs">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.amountKg}
                            onChange={(e) => onAmountChange?.(item.ingredientId, Number(e.target.value) || 0)}
                            className="w-full border-0 bg-transparent p-0 text-sm text-foreground outline-none"
                          />
                          <span className="text-xs text-muted-foreground">kg</span>
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
                      <MoneyText amount={c?.costTk ?? 0} />
                    </TableCell>
                    {!readOnly ? (
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => onRemove?.(item.ingredientId)}
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

              <TableRow className="bg-muted/60 font-medium hover:bg-muted/60">
                <TableCell className="text-foreground">{t("totalFeedAmount")}</TableCell>
                <TableCell className="text-center">
                  {numberFmt(totalAmountKg)} <span className="text-xs font-normal text-muted-foreground">kg</span>
                </TableCell>
                <NutrientCell
                  value={totals.dmKg}
                  rate={`${numberFmt(dmPctOf(totals.dmKg, totalAmountKg))}%`}
                  toneClass=""
                />
                {NUTRIENT_COLUMNS.map((col) => (
                  <NutrientCell
                    key={col.key}
                    value={totals[col.key]}
                    rate={totalsRate(col, totals[col.key], totals.dmKg)}
                    toneClass={GROUP_STYLES[col.group].text}
                  />
                ))}
                <TableCell className="text-center">
                  <MoneyText amount={totals.totalCostTk} />
                </TableCell>
                {!readOnly ? <TableCell /> : null}
              </TableRow>

              {showPerCow ? (
                <TableRow className="bg-muted/60 font-medium hover:bg-muted/60">
                  <TableCell>
                    <p className="text-foreground">{t("dailyTotalAmount")}</p>
                    <p className="text-xs font-normal text-muted-foreground">{t("perCow")}</p>
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
              ) : null}

              {requirements ? (
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
            </TableBody>
          </Table>
        </div>
      </div>

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
