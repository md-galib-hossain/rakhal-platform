"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Package, Wheat, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rakhal/ui/ui/table";
import { MoneyText } from "@/components/shared/money-text";
import { Chip } from "@rakhal/ui/ui/chip";
import { Badge } from "@rakhal/ui/ui/badge";
import type { FeedItem } from "@/features/inventory/types";
import type { FeedConcentrationSummary } from "../../types";
import type { Requirements, EffectiveIngredientNutrition } from "../../lib/formula-math";
import { itemStockKg, effectiveFromLot } from "../../lib/recipe-line";
import type { PreviewFitResult } from "../../plans-types";

export interface PlanTableLine {
  id?: string;
  lineType: "FEED_ITEM" | "PREPARED";
  feedItemId?: string;
  concentrationId?: string;
  name: string;
  kgPerDay: number;
}

export interface PlanMixtureTableProps {
  lines: PlanTableLine[];
  feedItems: FeedItem[];
  concentrations: FeedConcentrationSummary[];
  requirements: Requirements | null;
  previewFit?: PreviewFitResult | null;
  onAmountChange: (index: number, kgPerDay: number) => void;
  onRemove: (index: number) => void;
}

const numberFmt = (v: number | null | undefined) =>
  v == null ? "—" : Number.isInteger(v) ? String(v) : v.toFixed(2);

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

  if ((Number(text) || 0) !== value) setText(value === 0 ? "" : String(value));

  const isExceeded = max != null && value > max;

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={max}
          step="0.1"
          data-amount-input
          placeholder="0"
          value={text}
          onChange={(e) => {
            const raw = e.target.value;
            const num = Number(raw) || 0;
            setText(raw);
            onChange(num);
          }}
          onFocus={(e) => e.currentTarget.select()}
          className={cn(
            "w-20 rounded-md border border-input bg-background px-2 py-1 text-sm font-semibold text-foreground outline-none focus:ring-1 focus:ring-primary",
            isExceeded && "border-destructive text-destructive",
          )}
        />
        <span className="text-xs text-muted-foreground">kg/day</span>
      </div>
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

export function PlanMixtureTable({
  lines,
  feedItems,
  concentrations,
  requirements,
  previewFit,
  onAmountChange,
  onRemove,
}: PlanMixtureTableProps) {
  const t = useTranslations("feed.table");
  const tFeed = useTranslations("feed");
  const tPlans = useTranslations("feed.plans.editor");

  const feedItemMap = useMemo(() => new Map(feedItems.map((i) => [i.id, i])), [feedItems]);
  const concentrationMap = useMemo(() => new Map(concentrations.map((c) => [c.id, c])), [concentrations]);

  // Derive per-line 12-nutrient profile
  const lineDetails = useMemo(() => {
    return lines.map((line) => {
      let eff: EffectiveIngredientNutrition = {
        dmPct: 88,
        cpPct: 14,
        rdpPct: 60,
        rupPct: 40,
        meMjPerKgDm: 10,
        fatPct: 3,
        starchPct: 15,
        tdnPct: 65,
        ndfPct: 30,
        adfPct: 20,
        calciumPct: 0.5,
        phosphorusPct: 0.4,
        pricePerKg: 0,
      };

      let availableStockKg: number | null = null;
      let itemObj: FeedItem | undefined;
      let concentrationObj: FeedConcentrationSummary | undefined;

      if (line.lineType === "FEED_ITEM" && line.feedItemId) {
        itemObj = feedItemMap.get(line.feedItemId);
        if (itemObj) {
          availableStockKg = Math.round(itemStockKg(itemObj) * 100) / 100;
          const lotEff = effectiveFromLot(itemObj);
          if (lotEff) eff = { ...eff, ...lotEff };
        }
      } else if (line.lineType === "PREPARED" && line.concentrationId) {
        concentrationObj = concentrationMap.get(line.concentrationId);
        if (concentrationObj) {
          const tot = concentrationObj.totals;
          if (tot && tot.dm_kg > 0) {
            eff = {
              dmPct: 88,
              cpPct: (tot.cp_kg / tot.dm_kg) * 100,
              rdpPct: tot.cp_kg > 0 ? (tot.rdp_kg / tot.cp_kg) * 100 : 60,
              rupPct: tot.cp_kg > 0 ? (tot.rup_kg / tot.cp_kg) * 100 : 40,
              meMjPerKgDm: tot.me_mj / tot.dm_kg,
              fatPct: (tot.fat_kg / tot.dm_kg) * 100,
              starchPct: (tot.starch_kg / tot.dm_kg) * 100,
              tdnPct: (tot.tdn_kg / tot.dm_kg) * 100,
              ndfPct: (tot.ndf_kg / tot.dm_kg) * 100,
              adfPct: (tot.adf_kg / tot.dm_kg) * 100,
              calciumPct: (tot.calcium_kg / tot.dm_kg) * 100,
              phosphorusPct: (tot.phosphorus_kg / tot.dm_kg) * 100,
              pricePerKg: tot.total_cost_tk / (tot.dm_kg / 0.88),
            };
          }
        }
      }

      const amountKg = line.kgPerDay || 0;
      const dmKg = (amountKg * eff.dmPct) / 100;
      const cpKg = (dmKg * eff.cpPct) / 100;
      const rdpKg = (cpKg * (eff.rdpPct ?? 0)) / 100;
      const rupKg = (cpKg * (eff.rupPct ?? 0)) / 100;
      const meMj = dmKg * eff.meMjPerKgDm;
      const fatKg = (dmKg * (eff.fatPct ?? 0)) / 100;
      const starchKg = (dmKg * (eff.starchPct ?? 0)) / 100;
      const tdnKg = (dmKg * (eff.tdnPct ?? 0)) / 100;
      const ndfKg = (dmKg * (eff.ndfPct ?? 0)) / 100;
      const adfKg = (dmKg * (eff.adfPct ?? 0)) / 100;
      const calciumKg = (dmKg * (eff.calciumPct ?? 0)) / 100;
      const phosphorusKg = (dmKg * (eff.phosphorusPct ?? 0)) / 100;
      const costTk = amountKg * eff.pricePerKg;

      return {
        line,
        itemObj,
        concentrationObj,
        availableStockKg,
        amountKg,
        eff,
        dmKg,
        cpKg,
        rdpKg,
        rupKg,
        meMj,
        fatKg,
        starchKg,
        tdnKg,
        ndfKg,
        adfKg,
        calciumKg,
        phosphorusKg,
        costTk,
      };
    });
  }, [lines, feedItemMap, concentrationMap]);

  // Overall totals across all 12 nutrients
  const totals = useMemo(() => {
    return lineDetails.reduce(
      (acc, curr) => ({
        amountKg: acc.amountKg + curr.amountKg,
        dmKg: acc.dmKg + curr.dmKg,
        cpKg: acc.cpKg + curr.cpKg,
        rdpKg: acc.rdpKg + curr.rdpKg,
        rupKg: acc.rupKg + curr.rupKg,
        meMj: acc.meMj + curr.meMj,
        fatKg: acc.fatKg + curr.fatKg,
        starchKg: acc.starchKg + curr.starchKg,
        tdnKg: acc.tdnKg + curr.tdnKg,
        ndfKg: acc.ndfKg + curr.ndfKg,
        adfKg: acc.adfKg + curr.adfKg,
        calciumKg: acc.calciumKg + curr.calciumKg,
        phosphorusKg: acc.phosphorusKg + curr.phosphorusKg,
        costTk: acc.costTk + curr.costTk,
      }),
      {
        amountKg: 0,
        dmKg: 0,
        cpKg: 0,
        rdpKg: 0,
        rupKg: 0,
        meMj: 0,
        fatKg: 0,
        starchKg: 0,
        tdnKg: 0,
        ndfKg: 0,
        adfKg: 0,
        calciumKg: 0,
        phosphorusKg: 0,
        costTk: 0,
      },
    );
  }, [lineDetails]);

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

  if (lines.length === 0) {
    return (
      <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        <p>{tPlans("noLines")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead rowSpan={2} className="min-w-[200px] align-middle">
                  {t("ingredientName")}
                </TableHead>
                <TableHead rowSpan={2} className="min-w-[140px] align-middle">
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
                <TableHead rowSpan={2} className="w-10" />
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
              {lineDetails.map((item, index) => {
                const isInventory = item.line.lineType === "FEED_ITEM";
                const isTmr = item.concentrationObj?.kind === "FEED_MIXTURE";

                return (
                  <TableRow key={`line-${item.line.feedItemId ?? item.line.concentrationId ?? index}`}>
                    <TableCell className="font-medium text-foreground">
                      <div className="flex flex-col gap-1">
                        <span className="truncate">{item.line.name}</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isInventory ? (
                            <>
                              <Chip variant="teal" className="w-fit px-1.5 py-0 text-xs font-medium gap-1">
                                <Package className="size-2.5 shrink-0" />
                                {tFeed("sourceInventory")}
                              </Chip>
                              {item.availableStockKg != null ? (
                                <span
                                  className={cn(
                                    "text-xs font-medium",
                                    item.availableStockKg <= 0 ? "text-destructive" : "text-muted-foreground",
                                  )}
                                >
                                  {item.availableStockKg > 0
                                    ? tFeed("stockAmount", { stock: numberFmt(item.availableStockKg) })
                                    : tFeed("outOfStockBadge")}
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <Chip
                              variant={isTmr ? "purple" : "info"}
                              className="w-fit px-1.5 py-0 text-xs font-medium gap-1"
                            >
                              <Wheat className="size-2.5 shrink-0" />
                              {isTmr ? tFeed("feedMixture") : tFeed("concentrationTemplate")}
                            </Chip>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <AmountInput
                        value={item.amountKg}
                        max={item.availableStockKg ?? undefined}
                        onChange={(val) => onAmountChange(index, val)}
                      />
                    </TableCell>

                    {/* DM Column */}
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center leading-tight">
                        <span>{numberFmt(item.dmKg)}</span>
                        <span className="text-xs text-muted-foreground">{numberFmt(item.eff.dmPct)}%</span>
                      </div>
                    </TableCell>

                    {/* 11 Nutrient Columns */}
                    {NUTRIENT_COLUMNS.map((col) => {
                      const val = item[col.key];
                      const rate =
                        col.rateKey === "meMjPerKgDm"
                          ? `${numberFmt(item.eff.meMjPerKgDm)} MJ`
                          : `${numberFmt(item.eff[col.rateKey])}%`;

                      return (
                        <TableCell
                          key={col.key}
                          className={cn("text-center", GROUP_STYLES[col.group].bg)}
                        >
                          <div className="flex flex-col items-center leading-tight">
                            <span>{numberFmt(val)}</span>
                            <span className="text-xs text-muted-foreground">{rate}</span>
                          </div>
                        </TableCell>
                      );
                    })}

                    <TableCell className="text-center font-medium">
                      <MoneyText amount={item.costTk} />
                    </TableCell>

                    <TableCell>
                      <button
                        type="button"
                        onClick={() => onRemove(index)}
                        aria-label={t("removeItem")}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                      >
                        <X className="size-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}

              {/* Total Feed Amount Row */}
              <TableRow className="border-t-2 border-border bg-muted/70 font-semibold hover:bg-muted/70">
                <TableCell className="font-bold text-foreground">{t("totalFeedAmount")}</TableCell>
                <TableCell>
                  <span>{numberFmt(totals.amountKg)} kg/day</span>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex flex-col items-center leading-tight">
                    <span>{numberFmt(totals.dmKg)}</span>
                    <span className="text-xs text-muted-foreground">
                      {totals.amountKg > 0 ? `${numberFmt((totals.dmKg / totals.amountKg) * 100)}%` : "—"}
                    </span>
                  </div>
                </TableCell>
                {NUTRIENT_COLUMNS.map((col) => {
                  const nutrientTotal = totals[col.key];
                  const rateStr =
                    col.unit !== "%"
                      ? totals.dmKg > 0
                        ? `${numberFmt(nutrientTotal / totals.dmKg)} ${col.unit}`
                        : "—"
                      : `${numberFmt(totals.dmKg > 0 ? (nutrientTotal / totals.dmKg) * 100 : 0)}%`;

                  return (
                    <TableCell key={col.key} className={cn("text-center", GROUP_STYLES[col.group].bg)}>
                      <div className="flex flex-col items-center leading-tight">
                        <span>{numberFmt(nutrientTotal)}</span>
                        <span className="text-xs text-muted-foreground">{rateStr}</span>
                      </div>
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-bold">
                  <MoneyText amount={totals.costTk} />
                </TableCell>
                <TableCell />
              </TableRow>

              {/* Daily Total Requirement (per cow) comparison Row */}
              {requirements ? (
                <TableRow className="bg-muted/40 font-semibold hover:bg-muted/40">
                  <TableCell className="text-muted-foreground">
                    <div className="flex flex-col">
                      <span>{t("dailyTotalRequirement")}</span>
                      <span className="text-xs font-normal text-muted-foreground">({t("perCow")})</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">—</TableCell>
                  <TableCell className={cn("text-center", cellTone(totals.dmKg, requirements.dmKg))}>
                    {numberFmt(requirements.dmKg)}
                  </TableCell>
                  {NUTRIENT_COLUMNS.map((col) => {
                    let reqVal: number | undefined;
                    if (col.key === "cpKg") reqVal = requirements.cpKg;
                    else if (col.key === "meMj") reqVal = requirements.meMj;
                    else if (col.key === "fatKg") reqVal = requirements.fatKg;
                    else if (col.key === "ndfKg") reqVal = requirements.ndfKg;

                    return (
                      <TableCell
                        key={col.key}
                        className={cn("text-center", reqVal != null ? cellTone(totals[col.key], reqVal) : undefined)}
                      >
                        {reqVal != null ? numberFmt(reqVal) : "—"}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center text-muted-foreground">—</TableCell>
                  <TableCell />
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </div>

      {previewFit?.fit ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{tFeed("requirementsLegend")}:</span>
            <Badge
              variant={
                previewFit.fit.severity === "ok"
                  ? "success"
                  : previewFit.fit.severity === "warn"
                    ? "warning"
                    : "destructive"
              }
            >
              {previewFit.fit.severity === "ok"
                ? tFeed("legendMet")
                : previewFit.fit.severity === "warn"
                  ? tFeed("legendExceeded")
                  : tFeed("legendNotMet")}
            </Badge>
          </div>
          {previewFit.fit.estimated ? (
            <p className="text-xs text-muted-foreground">{tPlans("shortcutNote", { kind: "" }).trim()}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
