import { describe, expect, it } from "vitest";
import { buildCaseEvents, readableActor, suggestNext } from "./case-events";
import type { HealthCaseDetail, HealthTask, HealthUpdate, TreatmentLog } from "./types";

const at = (day: number, hour = 9) => new Date(2026, 9, day, hour, 0, 0).toISOString();

const task = (id: string, day: number, over: Partial<HealthTask> = {}): HealthTask =>
  ({
    id,
    dueDateTime: at(day),
    status: "PENDING",
    title: `Step ${id}`,
    stepNumber: null,
    totalSteps: null,
    completedAt: null,
    ...over,
  }) as HealthTask;

const update = (id: string, day: number, progress: HealthUpdate["clinicalProgress"]): HealthUpdate =>
  ({ id, recordedAt: at(day), clinicalProgress: progress, temperature: 39, observation: null, recordedBy: "Rina" }) as HealthUpdate;

const treatment = (id: string, day: number, over: Partial<TreatmentLog> = {}): TreatmentLog =>
  ({ id, administeredAt: at(day), medicineName: "Penicillin", doseAmount: 5, doseUnit: "ml", route: "IM", administeredBy: "Rina", healthTaskId: null, ...over }) as TreatmentLog;

const makeCase = (over: Partial<HealthCaseDetail> = {}): HealthCaseDetail =>
  ({
    id: "c1",
    startDate: at(1),
    condition: "MASTITIS",
    note: null,
    priority: "HIGH",
    status: "ACTIVE",
    treatmentLogs: [],
    healthUpdates: [],
    tasks: [],
    mortalityRecord: null,
    closedDate: null,
    closeReason: null,
    reportedBy: null,
    summary: undefined,
    ...over,
  }) as unknown as HealthCaseDetail;

describe("buildCaseEvents", () => {
  it("lists the case story newest first, with the opening last", () => {
    const events = buildCaseEvents(
      makeCase({ healthUpdates: [update("u1", 3, "STABLE")], treatmentLogs: [treatment("t1", 2), treatment("t2", 4)] }),
    );
    expect(events.map((e) => e.kind)).toEqual(["treatment", "update", "treatment", "opened"]);
  });

  it("does not list a completed step twice when its treatment was logged through it", () => {
    const events = buildCaseEvents(
      makeCase({
        tasks: [task("k1", 2, { status: "COMPLETED", completedAt: at(2), stepNumber: 1, totalSteps: 5 })],
        treatmentLogs: [treatment("t1", 2, { healthTaskId: "k1" })],
      }),
    );
    expect(events.filter((e) => e.kind === "stepDone")).toHaveLength(0);
    const log = events.find((e) => e.kind === "treatment");
    expect(log && log.kind === "treatment" && log.step).toMatchObject({ number: 1, total: 5 });
  });

  it("shows a completed step that has no treatment, and missed / skipped steps; leaves pending steps to the summary", () => {
    const events = buildCaseEvents(
      makeCase({
        tasks: [
          task("a", 2, { status: "COMPLETED", completedAt: at(2) }),
          task("b", 3, { status: "MISSED" }),
          task("c", 4, { status: "SKIPPED" }),
          task("d", 9, { status: "PENDING" }),
        ],
      }),
    );
    expect(events.map((e) => e.kind).sort()).toEqual(["opened", "step", "step", "stepDone"]);
  });

  it("ends with the closing event once the case is closed", () => {
    const events = buildCaseEvents(makeCase({ status: "RECOVERED", closedDate: at(8), closeReason: "Recovered" }));
    expect(events[0]).toMatchObject({ kind: "closed", status: "RECOVERED", reason: "Recovered" });
  });
});

describe("readableActor", () => {
  it("keeps a name, drops a raw user id, and tolerates empty", () => {
    expect(readableActor("Demo Worker")).toBe("Demo Worker");
    expect(readableActor("cmuf4t0ws004chofc7x44mncj")).toBeNull();
    expect(readableActor(null)).toBeNull();
    expect(readableActor("")).toBeNull();
  });
});

describe("suggestNext", () => {
  const now = new Date(2026, 9, 5, 10, 0, 0);

  it("suggests nothing for a closed case", () => {
    expect(suggestNext(makeCase({ status: "RECOVERED" }), now)).toBeNull();
  });

  it("suggests recording a step that is due today or overdue", () => {
    expect(suggestNext(makeCase({ tasks: [task("a", 5)] }), now)).toMatchObject({ kind: "recordStep", overdue: false });
    expect(suggestNext(makeCase({ tasks: [task("a", 3)] }), now)).toMatchObject({ kind: "recordStep", overdue: true });
  });

  it("does not nag about a step that is still in the future", () => {
    expect(suggestNext(makeCase({ tasks: [task("a", 9)], summary: { protocol: { id: "p", name: "P" } } as never }), now)).toBeNull();
  });

  it("suggests applying a protocol when the case has none and nothing is scheduled", () => {
    expect(suggestNext(makeCase({ summary: { protocol: null } as never }), now)).toMatchObject({ kind: "applyProtocol" });
  });

  it("suggests closing as recovered after three improving updates with nothing left to do", () => {
    const improving = [update("u1", 2, "IMPROVING"), update("u2", 3, "IMPROVING"), update("u3", 4, "IMPROVING")];
    expect(
      suggestNext(makeCase({ healthUpdates: improving, summary: { protocol: { id: "p", name: "P" } } as never }), now),
    ).toMatchObject({ kind: "closeRecovered" });
    // one stable update breaks the run
    const mixed = [update("u1", 2, "IMPROVING"), update("u2", 3, "STABLE"), update("u3", 4, "IMPROVING")];
    expect(suggestNext(makeCase({ healthUpdates: mixed, summary: { protocol: { id: "p", name: "P" } } as never }), now)).toBeNull();
  });
});
