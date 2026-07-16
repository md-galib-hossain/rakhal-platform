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
        pricePerKg: ing.effective_price_per_kg,
      },
    ]),
  );
}

const numberFmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));

/**
 * "Feed Mixture" ingredient table (Figma `1065:35817`) — Ingredient Name/Amount/DM columns + Protein
 * (CP only — RDP/RUP dropped, no backend data, see `lib/formula-math.ts`'s doc comment) + Energy
 * (ME/FAT — STR dropped) + Fibers (NDF — SUG dropped) + Cost, followed by Total Feed Amount / Daily
 * Total Amount (per cow — real division by the feed group's `assigned_count`, 1 for an Individual
 * target) / Daily Total Requirement (per cow, from `GET /feed/requirements`) rows. The last two rows'
 * per-nutrient cells are tinted success/destructive by whether the daily amount meets that
 * requirement — the same real comparison the "Feed Mixture ... % Completed" bar and each card's
 * Balance Score summarize as one number.
 */
export function FeedMixtureTable({
  items,
  effectiveById,
  requirements,
  cowCount,
  onAmountChange,
  onRemove,
  readOnly = false,
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

  const dailyTotals = useMemo(() => {
    const divisor = cowCount > 0 ? cowCount : 1;
    return {
      dmKg: totals.dmKg / divisor,
      cpKg: totals.cpKg / divisor,
      meMj: totals.meMj / divisor,
      fatKg: totals.fatKg / divisor,
      ndfKg: totals.ndfKg / divisor,
    };
  }, [totals, cowCount]);

  const score = requirements ? balanceScore(totals, requirements) : null;
  const band = score != null ? balanceScoreBand(score) : null;

  function cellTone(actual: number, required: number | undefined) {
    if (required == null) return undefined;
    return actual >= required ? "bg-success-tint" : "bg-destructive-tint";
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl border border-border">
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
              <TableHead colSpan={1} className="bg-info-tint text-center text-info">
                {t("protein")}
              </TableHead>
              <TableHead colSpan={2} className="bg-warning-tint text-center text-warning">
                {t("energy")}
              </TableHead>
              <TableHead colSpan={1} className="bg-success-tint text-center text-success">
                {t("fibers")}
              </TableHead>
              <TableHead rowSpan={2} className="text-center align-middle">
                {t("cost")}
              </TableHead>
              {!readOnly ? <TableHead rowSpan={2} className="w-10" /> : null}
            </TableRow>
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead className="bg-info-tint text-center text-xs font-medium normal-case text-muted-foreground">
                {t("cpKg")}
              </TableHead>
              <TableHead className="bg-warning-tint text-center text-xs font-medium normal-case text-muted-foreground">
                {t("meMj")}
              </TableHead>
              <TableHead className="bg-warning-tint text-center text-xs font-medium normal-case text-muted-foreground">
                {t("fatKg")}
              </TableHead>
              <TableHead className="bg-success-tint text-center text-xs font-medium normal-case text-muted-foreground">
                {t("ndfKg")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const c = contributionById.get(item.ingredientId);
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
                  <TableCell className="text-center">{numberFmt(c?.dmKg ?? 0)}</TableCell>
                  <TableCell className="text-center text-info">{numberFmt(c?.cpKg ?? 0)}</TableCell>
                  <TableCell className="text-center text-warning">{numberFmt(c?.meMj ?? 0)}</TableCell>
                  <TableCell className="text-center text-warning">{numberFmt(c?.fatKg ?? 0)}</TableCell>
                  <TableCell className="text-center text-success">{numberFmt(c?.ndfKg ?? 0)}</TableCell>
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
              <TableCell colSpan={2} className="text-foreground">
                {t("totalFeedAmount")}
              </TableCell>
              <TableCell className="text-center">{numberFmt(totals.dmKg)}</TableCell>
              <TableCell className="text-center text-info">{numberFmt(totals.cpKg)}</TableCell>
              <TableCell className="text-center text-warning">{numberFmt(totals.meMj)}</TableCell>
              <TableCell className="text-center text-warning">{numberFmt(totals.fatKg)}</TableCell>
              <TableCell className="text-center text-success">{numberFmt(totals.ndfKg)}</TableCell>
              <TableCell className="text-center">
                <MoneyText amount={totals.totalCostTk} />
              </TableCell>
              {!readOnly ? <TableCell /> : null}
            </TableRow>

            <TableRow className="bg-muted/60 font-medium hover:bg-muted/60">
              <TableCell colSpan={2}>
                <p className="text-foreground">{t("dailyTotalAmount")}</p>
                <p className="text-xs font-normal text-muted-foreground">{t("perCow")}</p>
              </TableCell>
              <TableCell className="text-center">{numberFmt(dailyTotals.dmKg)}</TableCell>
              <TableCell className="text-center text-info">{numberFmt(dailyTotals.cpKg)}</TableCell>
              <TableCell className="text-center text-warning">{numberFmt(dailyTotals.meMj)}</TableCell>
              <TableCell className="text-center text-warning">{numberFmt(dailyTotals.fatKg)}</TableCell>
              <TableCell className="text-center text-success">{numberFmt(dailyTotals.ndfKg)}</TableCell>
              <TableCell className="text-center">—</TableCell>
              {!readOnly ? <TableCell /> : null}
            </TableRow>

            {requirements ? (
              <TableRow className="font-medium hover:bg-transparent">
                <TableCell colSpan={2}>
                  <p className="text-foreground">{t("dailyTotalRequirement")}</p>
                  <p className="text-xs font-normal text-muted-foreground">{t("perCow")}</p>
                </TableCell>
                <TableCell className={cn("text-center", cellTone(dailyTotals.dmKg, requirements.dmKg))}>
                  {numberFmt(requirements.dmKg)}
                </TableCell>
                <TableCell className={cn("text-center", cellTone(dailyTotals.cpKg, requirements.cpKg))}>
                  {numberFmt(requirements.cpKg)}
                </TableCell>
                <TableCell className={cn("text-center", cellTone(dailyTotals.meMj, requirements.meMj))}>
                  {numberFmt(requirements.meMj)}
                </TableCell>
                <TableCell className={cn("text-center", cellTone(dailyTotals.fatKg, requirements.fatKg))}>
                  {numberFmt(requirements.fatKg)}
                </TableCell>
                <TableCell className={cn("text-center", cellTone(dailyTotals.ndfKg, requirements.ndfKg))}>
                  {numberFmt(requirements.ndfKg)}
                </TableCell>
                <TableCell className="text-center">—</TableCell>
                {!readOnly ? <TableCell /> : null}
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
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
