import { describe, expect, it } from "vitest";
import { defaultProtocolsView, needsAttention, roundProgressPct, roundUrgency, runningRoundsByPlan } from "./round-model";
import type { ProtocolRound } from "./types";

let n = 0;
const round = (over: Partial<ProtocolRound> = {}): ProtocolRound => {
  n += 1;
  return {
    roundKey: `app:r${n}`,
    healthPlan: { id: "p1", name: "FMD vaccine", category: "VACCINATION", deletedAt: null },
    kind: "PREVENTION",
    startDate: "2026-10-01",
    animalCount: 2,
    stepsTotal: 4,
    stepsDone: 0,
    stepsSkipped: 0,
    stepsOverdue: 0,
    stepsDueToday: 0,
    nextDueDate: null,
    status: "RUNNING",
    ...over,
  };
};

describe("roundUrgency", () => {
  it("most late first, then most due today, then the soonest next step, then the newest round", () => {
    const list = [
      round({ roundKey: "quiet", nextDueDate: "2026-10-09" }),
      round({ roundKey: "soon", nextDueDate: "2026-10-04" }),
      round({ roundKey: "today", stepsDueToday: 2 }),
      round({ roundKey: "late", stepsOverdue: 1 }),
      round({ roundKey: "later", stepsOverdue: 3 }),
      round({ roundKey: "nothing" }),
    ];
    expect([...list].sort(roundUrgency).map((r) => r.roundKey)).toEqual(["later", "late", "today", "soon", "quiet", "nothing"]);
  });

  it("with everything equal, the newer round comes first", () => {
    const older = round({ roundKey: "a", startDate: "2026-09-01" });
    const newer = round({ roundKey: "b", startDate: "2026-10-01" });
    expect([older, newer].sort(roundUrgency).map((r) => r.roundKey)).toEqual(["b", "a"]);
  });
});

describe("defaultProtocolsView (EPIC D1)", () => {
  it("opens on Running when any round has a step due or late", () => {
    expect(defaultProtocolsView([round(), round({ stepsDueToday: 1 })])).toBe("running");
    expect(defaultProtocolsView([round({ stepsOverdue: 2 })])).toBe("running");
  });

  it("opens on Library when nothing is running or nothing needs doing", () => {
    expect(defaultProtocolsView([])).toBe("library");
    expect(defaultProtocolsView([round({ nextDueDate: "2026-10-09" })])).toBe("library");
  });

  it("needsAttention is exactly 'a step due today or late'", () => {
    expect(needsAttention(round())).toBe(false);
    expect(needsAttention(round({ stepsDueToday: 1 }))).toBe(true);
    expect(needsAttention(round({ stepsOverdue: 1 }))).toBe(true);
  });
});

describe("runningRoundsByPlan", () => {
  it("counts running rounds per protocol", () => {
    const counts = runningRoundsByPlan([
      round(),
      round(),
      round({ healthPlan: { id: "p2", name: "Mastitis", category: "TREATMENT", deletedAt: null } }),
    ]);
    expect(counts.get("p1")).toBe(2);
    expect(counts.get("p2")).toBe(1);
    expect(counts.get("p3")).toBeUndefined();
  });
});

describe("roundProgressPct", () => {
  it("done out of the steps that are not skipped, capped at 100", () => {
    expect(roundProgressPct({ stepsDone: 1, stepsTotal: 4 })).toBe(25);
    expect(roundProgressPct({ stepsDone: 4, stepsTotal: 4 })).toBe(100);
    expect(roundProgressPct({ stepsDone: 5, stepsTotal: 4 })).toBe(100);
  });

  it("a round with no steps reads 0, not NaN", () => {
    expect(roundProgressPct({ stepsDone: 0, stepsTotal: 0 })).toBe(0);
  });
});
