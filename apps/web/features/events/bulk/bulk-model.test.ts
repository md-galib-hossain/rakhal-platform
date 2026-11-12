import { describe, expect, it } from "vitest";
import type { CattleListItem } from "@/features/cattle/types";
import { EVENT_BY_KEY } from "../catalogue/events";
import { FORM_DEFS } from "../forms/definitions";
import { buildBulkBodies, chunk, cleanValues, sharedDef, splitByEligibility, summarise, toFacts } from "./bulk-model";

const cow = (id: string, over: Partial<CattleListItem> = {}) =>
  ({ id, tagNumber: `T${id}`, gender: "FEMALE", animalCategory: "COW", herdStatus: "ACTIVE", productionStatus: "MILKING", dim: 40, reproductiveStatus: null, lifecycleSubStage: null, ...over }) as CattleListItem;

describe("bulk-model", () => {
  it("maps a list row to animal facts", () => {
    expect(toFacts(cow("1"))).toMatchObject({ gender: "FEMALE", animalCategory: "COW", herdStatus: "ACTIVE", productionStatus: "MILKING" });
  });

  it("splits valid and blocked animals for an event", () => {
    const bull = cow("2", { gender: "MALE", animalCategory: "BULL", productionStatus: null });
    const split = splitByEligibility(EVENT_BY_KEY.CALVING, [cow("1"), bull]);
    expect(split.valid.map((a) => a.id)).toEqual(["1"]);
    expect(split.blocked.map((b) => b.item.id)).toEqual(["2"]);
  });

  it("chunks ids by 100", () => {
    const ids = Array.from({ length: 230 }, (_, i) => String(i));
    expect(chunk(ids).map((c) => c.length)).toEqual([100, 100, 30]);
  });

  it("drops the per-animal field from the shared form", () => {
    expect(sharedDef(FORM_DEFS.WEIGHT!).fields.map((f) => f.name)).toEqual(["notes"]);
  });

  it("cleans grid values: blanks are missing, out-of-range invalid", () => {
    const r = cleanValues(FORM_DEFS.WEIGHT!, { a: "350", b: "", c: "5" }, ["a", "b", "c"]);
    expect(r.values).toEqual({ a: { weightKg: 350 } });
    expect(r.missing).toEqual(["b"]);
    expect(r.invalid).toEqual(["c"]);
  });

  it("builds one body per 100 animals with only that chunk's values", () => {
    const ids = Array.from({ length: 101 }, (_, i) => `id${i}`);
    const values = Object.fromEntries(ids.map((id) => [id, { weightKg: 300 }]));
    const bodies = buildBulkBodies(FORM_DEFS.WEIGHT!, { notes: " hi " }, { date: "2026-10-01", historical: true }, ids, values);
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toMatchObject({ type: "WEIGHT", provenance: "HISTORICAL", notes: "hi", mode: "skipIneligible" });
    expect(Object.keys(bodies[1].values ?? {})).toEqual(["id100"]);
  });

  it("summarises responses and lists skipped rows", () => {
    const s = summarise([
      { dryRun: true, batchId: null, requested: 2, saved: 0, skipped: 1, results: [{ cattleId: "1", tagNumber: "T1", status: "ELIGIBLE" }, { cattleId: "2", tagNumber: "T2", status: "SKIPPED", reason: "VALUES_MISSING" }] },
    ]);
    expect(s.eligible).toBe(1);
    expect(s.skipped.map((r) => r.reason)).toEqual(["VALUES_MISSING"]);
  });
});
