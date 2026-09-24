import type { FeedItem } from "@/features/inventory/types";
import type { EffectiveIngredientNutrition } from "./formula-math";

/** The bits of a recipe line that decide its identity (form item, API line, or payload). */
export interface RecipeLineRef {
  ingredientId?: string | null;
  feedItemId?: string | null;
  feedItemBatchId?: string | null;
}

/**
 * A recipe line's key — identical to the backend's `lineKey` (RAKHAL-447, ADR-026 D7). A line backed by
 * an inventory product is keyed by that product (plus the pinned lot when there is one) because its
 * nutrition and price come from the lot; any other line is keyed by its catalogue ingredient. Server
 * per-line figures and this form's rows meet on this key.
 */
export function formLineKey(line: RecipeLineRef): string {
  if (line.feedItemId) return line.feedItemBatchId ? `${line.feedItemId}:${line.feedItemBatchId}` : line.feedItemId;
  return line.ingredientId ?? "";
}

/**
 * The key a *distribution* line uses (`POST /feed/distributions` `items[].ingredientId`, backend
 * `FeedDistributionService.create`): the catalogue ingredient when the line has one, else its product id.
 * Not `formLineKey` — a distribution ignores the pinned lot in its key.
 */
export function distributionLineKey(line: { ingredient_id: string | null; feed_item_id: string | null }): string {
  return line.ingredient_id ?? line.feed_item_id ?? "";
}

/** kg in one unit of the item's stock (weight units convert through the unit itself). */
export function kgPerUnit(item: FeedItem): number | null {
  if (item.unit.dimension === "WEIGHT" && item.unit.conversionToBase != null) return item.unit.conversionToBase;
  return item.kgPerUnit;
}

/** Total available stock in kg for an inventory feed item. */
export function itemStockKg(item: FeedItem): number {
  if (item.kgEquivalent != null) return item.kgEquivalent;
  const kg = kgPerUnit(item);
  return kg && kg > 0 ? item.currentStock * kg : item.currentStock;
}

/** Client-side nutrition + price of a purchased lot — the pinned one, else the FIFO head (first lot with
 * stock, else the newest), the same pick the backend makes. `null` when the item has no usable lot. */
export function effectiveFromLot(item: FeedItem, batchId?: string | null): EffectiveIngredientNutrition | null {
  const lot = batchId ? item.batches.find((b) => b.id === batchId) : (item.batches.find((b) => b.currentStock > 0) ?? item.batches.at(-1));
  if (!lot) return null;
  const kg = kgPerUnit(item);
  const n = lot.nutrition;
  return {
    dmPct: n.dmPct,
    cpPct: n.cpPct,
    meMjPerKgDm: n.meMjPerKgDm,
    fatPct: n.fatPct,
    ndfPct: n.ndfPct,
    rdpPct: n.rdpPct,
    rupPct: n.rupPct,
    starchPct: n.starchPct,
    adfPct: n.adfPct,
    calciumPct: n.calciumPct,
    phosphorusPct: n.phosphorusPct,
    tdnPct: n.tdnPct,
    pricePerKg: kg && kg > 0 ? lot.costPerUnit / kg : 0,
  };
}

/** The per-line figures `GET /feed/concentrations/:id` returns (kg / MJ / Tk contributions). */
export interface LineFigures {
  amount_kg: number;
  dm_kg: number;
  cp_kg: number;
  me_mj: number;
  fat_kg: number;
  ndf_kg: number;
  rdp_kg: number;
  rup_kg: number;
  starch_kg: number;
  adf_kg: number;
  calcium_kg: number;
  phosphorus_kg: number;
  tdn_kg: number;
  cost_tk: number;
}

/**
 * Recovers a lot-backed line's per-kg rates from the figures the server already computed for it, so an
 * edit/read-only view can preview a lot line without re-fetching the lot. `null` when the line carries no
 * amount (nothing to divide by). Optional nutrients the lot never measured come back 0 here, not null —
 * the server's own formula math coerces them the same way (`?? 0`).
 */
export function effectiveFromFigures(line: LineFigures): EffectiveIngredientNutrition | null {
  if (line.amount_kg <= 0 || line.dm_kg <= 0) return null;
  const perDm = (kg: number) => (kg / line.dm_kg) * 100;
  return {
    dmPct: (line.dm_kg / line.amount_kg) * 100,
    cpPct: perDm(line.cp_kg),
    meMjPerKgDm: line.me_mj / line.dm_kg,
    fatPct: perDm(line.fat_kg),
    ndfPct: perDm(line.ndf_kg),
    rdpPct: line.cp_kg > 0 ? (line.rdp_kg / line.cp_kg) * 100 : 0,
    rupPct: line.cp_kg > 0 ? (line.rup_kg / line.cp_kg) * 100 : 0,
    starchPct: perDm(line.starch_kg),
    adfPct: perDm(line.adf_kg),
    calciumPct: perDm(line.calcium_kg),
    phosphorusPct: perDm(line.phosphorus_kg),
    tdnPct: perDm(line.tdn_kg),
    pricePerKg: line.cost_tk / line.amount_kg,
  };
}
