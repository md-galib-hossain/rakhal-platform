import { describe, expect, it } from "vitest";
import { buildProtocolGrid, cellState, dueTasksOfColumn, groupOfTasks, isDueState } from "./protocol-grid-model";
import type { HealthPlanStep, HealthTask } from "./types";

/** Local-time constructor → ISO, so the tests read the same in any timezone the runner happens to use. */
const local = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h, 0, 0);
const iso = (date: Date) => date.toISOString();
const NOW = local(2026, 10, 2, 9);

const step = (dayNumber: number, title: string): HealthPlanStep =>
  ({ id: `st-${dayNumber}`, dayNumber, title, actionType: "MEDICINE", medicineId: null, medicineName: null, doseAmount: null, doseUnit: null, route: null, instruction: null, estimatedTime: null, milkWithdrawalDays: null }) as unknown as HealthPlanStep;

let n = 0;
const task = (over: Partial<HealthTask> & { cow: string; due: Date }): HealthTask => {
  const { cow, due, ...rest } = over;
  n += 1;
  return {
    id: `t${n}`,
    farmId: "f",
    cattleId: `c-${cow}`,
    healthCaseId: null,
    planEnrollmentId: `e-${cow}`,
    taskCode: `code${n}`,
    taskDate: iso(due),
    dueDateTime: iso(due),
    status: "PENDING",
    taskType: "MEDICINE",
    title: "Dose",
    instruction: null,
    stepNumber: 1,
    totalSteps: 2,
    medicineId: null,
    medicineName: "Ceftriaxone",
    doseAmount: 5,
    doseUnit: "ml",
    route: null,
    completedAt: null,
    cattle: { id: `c-${cow}`, tagNumber: `TAG-${cow}`, name: cow },
    ...rest,
  } as HealthTask;
};

describe("cellState", () => {
  it("maps status and due day to done / skipped / overdue / today / upcoming", () => {
    expect(cellState(task({ cow: "A", due: local(2026, 9, 28), status: "COMPLETED" }), NOW).state).toBe("done");
    expect(cellState(task({ cow: "A", due: local(2026, 9, 28), status: "SKIPPED" }), NOW).state).toBe("skipped");
    expect(cellState(task({ cow: "A", due: local(2026, 9, 28) }), NOW)).toEqual({ state: "overdue", days: -4 });
    expect(cellState(task({ cow: "A", due: local(2026, 10, 2, 20) }), NOW).state).toBe("today");
    expect(cellState(task({ cow: "A", due: local(2026, 10, 4) }), NOW)).toEqual({ state: "upcoming", days: 2 });
  });

  it("a MISSED or OVERDUE step is late even if the date looks fine", () => {
    expect(cellState(task({ cow: "A", due: local(2026, 10, 3), status: "OVERDUE" }), NOW).state).toBe("overdue");
    expect(cellState(task({ cow: "A", due: local(2026, 10, 3), status: "MISSED" }), NOW).state).toBe("overdue");
  });

  it("only overdue and today count as due", () => {
    expect(["overdue", "today"].every((s) => isDueState(s as never))).toBe(true);
    expect(["done", "skipped", "upcoming"].some((s) => isDueState(s as never))).toBe(false);
  });
});

describe("buildProtocolGrid — the screenshot case: 2 cows, 2 steps", () => {
  const steps = [step(2, "Booster"), step(0, "First dose")]; // deliberately out of order
  const tasks = [
    task({ cow: "Bhola", due: local(2026, 10, 2), status: "COMPLETED", stepNumber: 1 }),
    task({ cow: "Bhola", due: local(2026, 9, 28), stepNumber: 2 }),
    task({ cow: "Tuni", due: local(2026, 10, 2), stepNumber: 1 }),
    task({ cow: "Tuni", due: local(2026, 10, 4), stepNumber: 2 }),
  ];
  const grid = buildProtocolGrid(tasks, steps, NOW);

  it("columns follow the protocol's days, not the order the steps were sent in", () => {
    expect(grid.columns.map((c) => [c.dayNumber, c.title])).toEqual([
      [0, "First dose"],
      [2, "Booster"],
    ]);
  });

  it("one row per cow with a cell per step", () => {
    expect(grid.rows.map((r) => r.label)).toEqual(["Bhola", "Tuni"]);
    expect(grid.rows[0].cells.s1.state).toBe("done");
    expect(grid.rows[0].cells.s2.state).toBe("overdue");
    expect(grid.rows[1].cells.s1.state).toBe("today");
    expect(grid.rows[1].cells.s2.state).toBe("upcoming");
  });

  it("totals what is due and what is late", () => {
    expect(grid.dueCount).toBe(2);
    expect(grid.overdueCount).toBe(1);
  });

  it("the most urgent cow is first", () => {
    expect(grid.rows[0].label).toBe("Bhola"); // has the overdue step
  });

  it("the column's due tasks are exactly its late and due-today cells", () => {
    expect(dueTasksOfColumn(grid, "s1").map((t) => t.cattle?.name)).toEqual(["Tuni"]);
    expect(dueTasksOfColumn(grid, "s2").map((t) => t.cattle?.name)).toEqual(["Bhola"]);
  });
});

describe("buildProtocolGrid — edge cases", () => {
  it("the same cow on two runs of the protocol is two rows", () => {
    const grid = buildProtocolGrid(
      [task({ cow: "Bhola", due: local(2026, 10, 2), planEnrollmentId: "e-1" }), task({ cow: "Bhola", due: local(2026, 10, 9), planEnrollmentId: "e-2" })],
      [step(0, "Dose")],
      NOW,
    );
    expect(grid.rows).toHaveLength(2);
  });

  it("a treatment run is keyed by its case", () => {
    const grid = buildProtocolGrid([task({ cow: "Lokkhi", due: local(2026, 10, 2), planEnrollmentId: null, healthCaseId: "case-1" })], [step(0, "Dose")], NOW);
    expect(grid.rows[0]).toMatchObject({ key: "case-1", healthCaseId: "case-1", planEnrollmentId: null });
  });

  it("a task that matches no step gets its own column instead of vanishing", () => {
    const grid = buildProtocolGrid([task({ cow: "A", due: local(2026, 10, 2), stepNumber: null, title: "Extra check" })], [step(0, "Dose")], NOW);
    expect(grid.columns.map((c) => c.title)).toEqual(["Dose", "Extra check"]);
    expect(grid.rows[0].cells["x:Extra check"]).toBeDefined();
  });

  it("no tasks → no rows, nothing due", () => {
    const grid = buildProtocolGrid([], [step(0, "Dose")], NOW);
    expect(grid.rows).toEqual([]);
    expect(grid.dueCount).toBe(0);
  });
});

describe("groupOfTasks — one group for the existing record / reschedule dialogs", () => {
  it("carries every task and the earliest due date", () => {
    const a = task({ cow: "A", due: local(2026, 9, 28) });
    const b = task({ cow: "B", due: local(2026, 10, 2) });
    const group = groupOfTasks([b, a])!;
    expect(group.tasks).toHaveLength(2);
    expect(group.dueDateTime).toBe(a.dueDateTime);
    expect(group.title).toBe("Dose");
  });

  it("is undefined for nothing", () => {
    expect(groupOfTasks([])).toBeUndefined();
  });
});
