import { describe, expect, it } from "vitest";
import type { FeedGridSection } from "../feed/plans-types";
import {
  DEFAULT_FIT_BANDS,
  bandsFromEffective,
  liveFit,
  liveSupply,
  buildInitialLines,
  clampKg,
  cowTotalKg,
  enforceStockCaps,
  hasOverStock,
  maxKgForLine,
  orderCows,
  requirementProgress,
  toEntry,
  usageBySource,
  type GridCow,
  type RowLine,
  type StockInfo,
} from "./grid-model";

const cow = (over: Partial<GridCow> = {}): GridCow => ({
  cattle_id: "c1",
  name: "Bhola",
  tag_number: "T-1",
  drafts: [],
  default_offered_kg: null,
  default_source: null,
  confirmed_offered_kg: null,
  program_section_id: null,
  program_conflict: false,
  planned_kg_by_line: {},
  requirement: null,
  planned_supply: null,
  confirmed_supply: null,
  fit: null,
  ...over,
});

const section: FeedGridSection = {
  id: "s1",
  plan_id: "p1",
  plan_name: "aaa",
  kind: "PLAN",
  via: "INDIVIDUAL",
  group_id: null,
  conflict: false,
  cattle_ids: ["c1"],
  fit_summary: { ok: 0, warn: 0, bad: 1, estimated: 1 },
  lines: [
    {
      line_id: "l1",
      line_type: "FEED_ITEM",
      name: "Soybean meal",
      kg_per_day: 10,
      prefill_kg: 5,
      source: { source_type: "FEED_ITEM", feed_item_id: "fi1", feed_stock_id: null },
      density: null,
      stock_ok: true,
    },
    {
      line_id: "l2",
      line_type: "PREPARED",
      name: "TMR",
      kg_per_day: 4,
      prefill_kg: 2,
      source: null,
      density: null,
      stock_ok: false,
    },
  ],
};

const line = (key: string, itemId: string, kg: string): RowLine => ({
  key,
  source: { sourceType: "FEED_ITEM", itemId },
  kg,
});

const stock = (kg: number | null): Map<string, StockInfo> =>
  new Map([["FEED_ITEM:fi1", { label: "Soybean meal", availableKg: kg }]]);

describe("buildInitialLines", () => {
  it("pre-fills a program cow's lines with the plan's per-session kg and keeps a no-batch line source-less", () => {
    const lines = buildInitialLines(cow({ program_section_id: "s1" }), section);
    expect(lines.map((l) => [l.planLineId, l.kg, l.source?.itemId ?? null])).toEqual([
      ["l1", "5", "fi1"],
      ["l2", "2", null],
    ]);
  });

  it("lets a saved draft win over the plan, and keeps unmatched drafts as extra lines", () => {
    const lines = buildInitialLines(
      cow({
        program_section_id: "s1",
        drafts: [
          { id: "d1", source_type: "FEED_ITEM", feed_item_id: "fi1", feed_stock_id: null, offered_kg: 7, plan_line_id: "l1" },
          { id: "d2", source_type: "FEED_ITEM", feed_item_id: "fi9", feed_stock_id: null, offered_kg: 1.5, plan_line_id: null },
        ],
      }),
      section,
    );
    expect(lines.find((l) => l.planLineId === "l1")?.kg).toBe("7");
    expect(lines.find((l) => l.key === "d:d2")).toMatchObject({ kg: "1.5", source: { itemId: "fi9" } });
  });

  it("does not pre-fill a cow with no program from yesterday's feeding", () => {
    const lines = buildInitialLines(
      cow({ default_offered_kg: 4, default_source: { source_type: "FEED_STOCK", feed_item_id: null, feed_stock_id: "st1" } }),
      undefined,
    );
    expect(lines).toEqual([]);
  });

  it("starts a cow with no drafts and no program empty", () => {
    expect(buildInitialLines(cow(), undefined)).toEqual([]);
  });
});

describe("stock caps", () => {
  it("sums usage across ticked cows only", () => {
    const lines = { a: [line("x", "fi1", "3")], b: [line("y", "fi1", "4")] };
    expect(usageBySource(lines, ["a"]).get("FEED_ITEM:fi1")).toBe(3);
    expect(usageBySource(lines, ["a", "b"]).get("FEED_ITEM:fi1")).toBe(7);
  });

  it("caps a line at on-hand minus what other ticked lines already draw", () => {
    // 10 kg on hand, another cow draws 4 → this line may hold at most 6, whether or not its own kg is counted.
    expect(maxKgForLine({ label: "s", availableKg: 10 }, 4 + 2, 2, true)).toBe(6);
    expect(maxKgForLine({ label: "s", availableKg: 10 }, 4, 2, false)).toBe(6);
  });

  it("does not cap when stock is unknown", () => {
    expect(maxKgForLine({ label: "s", availableKg: null }, 99, 1, true)).toBeNull();
    expect(maxKgForLine(undefined, 0, 0, true)).toBeNull();
  });

  it("never goes below zero", () => {
    expect(maxKgForLine({ label: "s", availableKg: 3 }, 8, 0, true)).toBe(0);
  });

  it("clamps typed values to the max and leaves valid ones alone", () => {
    expect(clampKg("12", 6)).toEqual({ value: "6", capped: true });
    expect(clampKg("5.5", 6)).toEqual({ value: "5.5", capped: false });
    expect(clampKg("", 6)).toEqual({ value: "", capped: false });
    expect(clampKg("99", null)).toEqual({ value: "99", capped: false });
  });

  it("enforceStockCaps gives the first cows their full kg and the rest what is left", () => {
    const lines = { a: [line("x", "fi1", "6")], b: [line("y", "fi1", "6")], c: [line("z", "fi1", "6")] };
    const { lines: out, reduced } = enforceStockCaps(lines, ["a", "b", "c"], stock(10));
    expect(out.a[0].kg).toBe("6");
    expect(out.b[0].kg).toBe("4");
    expect(out.c[0].kg).toBe("0");
    expect(reduced).toBe(2);
  });

  it("enforceStockCaps leaves uncapped sources untouched", () => {
    const lines = { a: [line("x", "fi1", "50")] };
    expect(enforceStockCaps(lines, ["a"], stock(null)).reduced).toBe(0);
  });

  it("hasOverStock flags a total above stock and only counts ticked cows", () => {
    const lines = { a: [line("x", "fi1", "6")], b: [line("y", "fi1", "6")] };
    expect(hasOverStock(lines, ["a", "b"], stock(10))).toBe(true);
    expect(hasOverStock(lines, ["a"], stock(10))).toBe(false);
  });
});

describe("live fit", () => {
  const d = { dm_pct: 90, cp_pct: 20, me_mj_per_kg_dm: 12 };
  const density = (key: string) => (key === "FEED_ITEM:fi1" ? d : null);
  // Needs exactly what 10 kg/day of that feed supplies: dm 9, cp 1.8, me 108.
  const req = { dm_kg: 9, cp_kg: 1.8, me_mj: 108 };

  it("scales one session's kg to the day and matches the backend formula", () => {
    const s = liveSupply([line("x", "fi1", "5")], density, 2);
    expect(s).toMatchObject({ dm_kg: 9, complete: true });
    expect(s.cp_kg).toBeCloseTo(1.8);
    expect(s.me_mj).toBeCloseTo(108);
    expect(liveFit(s, req, DEFAULT_FIT_BANDS, false).severity).toBe("ok");
  });

  it("moves the pill when the kg is edited", () => {
    const s = liveSupply([line("x", "fi1", "10")], density, 2); // double the need
    const fit = liveFit(s, req, DEFAULT_FIT_BANDS, false);
    expect(fit.dm.delta_pct).toBe(100);
    expect(fit.severity).toBe("bad");
    const low = liveFit(liveSupply([line("x", "fi1", "4.5")], density, 2), req, DEFAULT_FIT_BANDS, false);
    expect(low.dm.delta_pct).toBe(-10);
    expect(low.severity).toBe("ok"); // exactly on the band edge stays ok
  });

  it("marks the fit estimated when a fed line has unknown nutrition", () => {
    const s = liveSupply([line("x", "fi1", "5"), line("y", "mystery", "3")], density, 2);
    expect(s.complete).toBe(false);
    expect(liveFit(s, req, DEFAULT_FIT_BANDS, false).estimated).toBe(true);
  });

  it("reads alert bands from the farm's settings, falling back to defaults", () => {
    expect(bandsFromEffective({ alertProteinAbovePct: 35 }).cpAbovePct).toBe(35);
    expect(bandsFromEffective(undefined)).toEqual(DEFAULT_FIT_BANDS);
  });
});

describe("toEntry / totals / ordering", () => {
  it("builds the multi-line payload, dropping zero-kg and no-batch lines and keeping the plan-line link", () => {
    const lines: RowLine[] = [
      { ...line("x", "fi1", "5"), planLineId: "l1" },
      { key: "n", planLineId: "l2", source: null, kg: "2" },
      line("z", "fi2", "0"),
      { key: "s", source: { sourceType: "FEED_STOCK", itemId: "st1" }, kg: "3" },
    ];
    expect(toEntry("c1", lines, "0.5")).toEqual({
      cattleId: "c1",
      refusalKg: 0.5,
      lines: [
        { planLineId: "l1", sourceType: "FEED_ITEM", feedItemId: "fi1", feedStockId: undefined, offeredKg: 5 },
        { planLineId: undefined, sourceType: "FEED_STOCK", feedItemId: undefined, feedStockId: "st1", offeredKg: 3 },
      ],
    });
  });

  it("returns null when nothing is feedable", () => {
    expect(toEntry("c1", [line("x", "fi1", "")], "")).toBeNull();
  });

  it("totals only lines that have a batch", () => {
    expect(cowTotalKg([line("x", "fi1", "2.5"), { key: "n", source: null, kg: "9" }])).toBe(2.5);
  });

  it("orders program cows by section then cows with no program last", () => {
    const sections = [{ ...section, id: "s1" }, { ...section, id: "s2" }];
    const cows = [
      cow({ cattle_id: "none" }),
      cow({ cattle_id: "b", program_section_id: "s2" }),
      cow({ cattle_id: "a", program_section_id: "s1" }),
    ];
    expect(orderCows(cows, sections).map((c) => c.cattle_id)).toEqual(["a", "b", "none"]);
  });
});

describe("requirementProgress", () => {
  const req = { dm_kg: 10, cp_kg: 2, me_mj: 100 };
  it("is empty when nothing is fed", () => {
    expect(requirementProgress({ dm_kg: 0, cp_kg: 0, me_mj: 0 }, req)?.overall).toBe(0);
  });
  it("follows the limiting nutrient and caps at 100", () => {
    const p = requirementProgress({ dm_kg: 10, cp_kg: 1, me_mj: 200 }, req);
    expect(p).toMatchObject({ dm: 100, cp: 50, me: 100, overall: 50 });
  });
  it("is null with no requirement", () => {
    expect(requirementProgress({ dm_kg: 5, cp_kg: 1, me_mj: 50 }, null)).toBeNull();
  });
});
