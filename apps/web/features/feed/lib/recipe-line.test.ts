import { describe, expect, it } from "vitest";
import type { FeedItem } from "@/features/inventory/types";
import { distributionLineKey, effectiveFromFigures, effectiveFromLot, formLineKey, itemStockKg } from "./recipe-line";

const profile = (dmPct: number, cpPct: number, meMjPerKgDm: number) =>
  ({
    id: "p",
    dmPct,
    cpPct,
    meMjPerKgDm,
    moisturePct: 100 - dmPct,
    nutritionSource: "FARM_ESTIMATE",
    sourceRef: null,
    note: null,
    supersedesId: null,
    copiedFromIngredientId: null,
    createdAt: "",
    fatPct: null,
    ndfPct: null,
    adfPct: null,
    rdpPct: null,
    rupPct: null,
    starchPct: null,
    sugarsPct: null,
    calciumPct: null,
    phosphorusPct: null,
    tdnPct: null,
  }) as const;

const lot = (id: string, stock: number, cost: number, cp: number) => ({
  id,
  batchCode: id,
  currentStock: stock,
  costPerUnit: cost,
  purchaseDate: "",
  notes: null,
  createdAt: "",
  updatedAt: "",
  nutritionProfileId: "p",
  nutrition: profile(90, cp, 10),
});

const item = (batches: ReturnType<typeof lot>[]) =>
  ({
    unit: { dimension: "WEIGHT", conversionToBase: 1 },
    kgPerUnit: null,
    batches,
  }) as unknown as FeedItem;

describe("formLineKey", () => {
  it("keys a catalogue line by its ingredient", () => {
    expect(formLineKey({ ingredientId: "ing" })).toBe("ing");
  });

  it("keys a lot-backed line by its product, plus the pinned lot", () => {
    expect(formLineKey({ ingredientId: "ing", feedItemId: "item" })).toBe("item");
    expect(formLineKey({ ingredientId: "ing", feedItemId: "item", feedItemBatchId: "lot" })).toBe("item:lot");
    expect(formLineKey({ feedItemId: "item" })).toBe("item");
  });
});

describe("distributionLineKey", () => {
  it("prefers the ingredient and falls back to the product", () => {
    expect(distributionLineKey({ ingredient_id: "ing", feed_item_id: "item" })).toBe("ing");
    expect(distributionLineKey({ ingredient_id: null, feed_item_id: "item" })).toBe("item");
  });
});

describe("effectiveFromLot", () => {
  const two = item([lot("a", 0, 5, 9), lot("b", 20, 8, 15)]);

  it("uses the first lot that still has stock (FIFO head)", () => {
    const eff = effectiveFromLot(two);
    expect(eff?.cpPct).toBe(15);
    expect(eff?.pricePerKg).toBe(8);
  });

  it("uses a pinned lot even when an older one has stock", () => {
    const pinned = effectiveFromLot(item([lot("a", 10, 5, 9), lot("b", 20, 8, 15)]), "b");
    expect(pinned?.cpPct).toBe(15);
    expect(pinned?.pricePerKg).toBe(8);
  });

  it("falls back to the newest lot on an empty shelf and returns null with no lots", () => {
    expect(effectiveFromLot(item([lot("a", 0, 5, 9), lot("b", 0, 8, 15)]))?.cpPct).toBe(15);
    expect(effectiveFromLot(item([]))).toBeNull();
  });
});

describe("effectiveFromFigures", () => {
  it("recovers per-kg rates from a server-computed line", () => {
    // 10 kg fed at 90% DM, 15% CP, ME 10, ৳80 total.
    const eff = effectiveFromFigures({
      amount_kg: 10,
      dm_kg: 9,
      cp_kg: 1.35,
      me_mj: 90,
      fat_kg: 0,
      ndf_kg: 0,
      rdp_kg: 0,
      rup_kg: 0,
      starch_kg: 0,
      adf_kg: 0,
      calcium_kg: 0,
      phosphorus_kg: 0,
      tdn_kg: 0,
      cost_tk: 80,
    });
    expect(eff?.dmPct).toBeCloseTo(90);
    expect(eff?.cpPct).toBeCloseTo(15);
    expect(eff?.meMjPerKgDm).toBeCloseTo(10);
    expect(eff?.pricePerKg).toBe(8);
  });

  it("returns null when the line has no amount to divide by", () => {
    const zero = {
      amount_kg: 0,
      dm_kg: 0,
      cp_kg: 0,
      me_mj: 0,
      fat_kg: 0,
      ndf_kg: 0,
      rdp_kg: 0,
      rup_kg: 0,
      starch_kg: 0,
      adf_kg: 0,
      calcium_kg: 0,
      phosphorus_kg: 0,
      tdn_kg: 0,
      cost_tk: 0,
    };
    expect(effectiveFromFigures(zero)).toBeNull();
  });
});

describe("itemStockKg", () => {
  it("calculates total kg based on unit conversion", () => {
    const feedItem = {
      currentStock: 10,
      kgEquivalent: null,
      unit: { dimension: "WEIGHT", conversionToBase: 25 },
      kgPerUnit: null,
    } as unknown as FeedItem;
    expect(itemStockKg(feedItem)).toBe(250);
  });

  it("prefers kgEquivalent if already set", () => {
    const feedItem = {
      currentStock: 10,
      kgEquivalent: 500,
      unit: { dimension: "WEIGHT", conversionToBase: 25 },
      kgPerUnit: null,
    } as unknown as FeedItem;
    expect(itemStockKg(feedItem)).toBe(500);
  });
});
