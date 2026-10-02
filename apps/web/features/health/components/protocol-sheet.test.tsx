import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import type { HealthPlanListItem, HealthPlanStats, ProtocolRound } from "../types";
import { ProtocolSheet, type ProtocolSheetTarget } from "./protocol-sheet";

const h = vi.hoisted(() => ({
  filtersSeen: [] as Array<Record<string, unknown>>,
  tasks: { items: [] as unknown[], hasNextPage: false, isLoading: false, isError: false },
  plan: { data: undefined as unknown, isError: false },
}));

vi.mock("@/lib/auth/permissions", () => ({ Can: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("../hooks/use-health", () => ({
  useHealthPlan: () => ({ data: h.plan.data, isError: h.plan.isError, refetch: vi.fn() }),
  useHealthTasks: (filters: Record<string, unknown>) => {
    h.filtersSeen.push(filters);
    return {
      data: { items: h.tasks.items, meta: { hasNextPage: h.tasks.hasNextPage } },
      isLoading: h.tasks.isLoading,
      isError: h.tasks.isError,
      refetch: vi.fn(),
    };
  },
}));
vi.mock("./protocol-progress-grid", () => ({
  ProtocolProgressGrid: ({ plan, onManageCase }: { plan: { id: string }; onManageCase?: (id: string) => void }) => (
    <div data-testid="grid">
      grid-of-{plan.id}
      <button type="button" onClick={() => onManageCase?.("case-9")}>
        open-case-9
      </button>
    </div>
  ),
}));
vi.mock("./round-progress-grid", () => ({
  RoundProgressGrid: ({ round, onManageCase }: { round: { roundKey: string }; onManageCase?: (id: string) => void }) => (
    <div data-testid="round-grid">
      round-grid-of-{round.roundKey}
      <button type="button" onClick={() => onManageCase?.("case-7")}>
        open-case-7
      </button>
    </div>
  ),
}));
vi.mock("./round-animals-dialog", () => ({
  RoundAnimalsDialog: ({ open, round }: { open: boolean; round: { roundKey: string } }) => (open ? <div data-testid="add-dialog">add-to-{round.roundKey}</div> : null),
}));
vi.mock("./scheduled-task-card", () => ({
  ScheduledTaskCard: ({ group }: { group: { title: string; tasks: unknown[] } }) => (
    <div data-testid="step-card">
      {group.title} x{group.tasks.length}
    </div>
  ),
}));
vi.mock("./task-reschedule-dialog", () => ({ TaskRescheduleDialog: () => null }));
vi.mock("./record-batch-dialog", () => ({ RecordBatchDialog: () => null }));

const stats = (over: Partial<HealthPlanStats> = {}): HealthPlanStats => ({
  kind: "TREATMENT",
  appliedTo: 4,
  inProgress: 3,
  recovered: 1,
  mortality: 0,
  recoveryRate: 100,
  completed: null,
  due: null,
  coverageRate: null,
  stepsDue: 1,
  stepsOverdue: 0,
  nextDueDate: null,
  ...over,
});

function plan(over: Partial<HealthPlanListItem> = {}, s: Partial<HealthPlanStats> = {}): HealthPlanListItem {
  return {
    id: "p1",
    name: "Mastitis 5-day",
    category: "TREATMENT",
    planType: "MEDICAL",
    description: null,
    diagnosis: null,
    condition: "MASTITIS",
    cycleLengthDays: 5,
    totalActionSteps: 2,
    isTemplate: false,
    steps: [
      { id: "s1", dayNumber: 1, title: "Penicillin", instruction: "Inject 5 ml" },
      { id: "s2", dayNumber: 2, title: "Rest", instruction: null },
    ] as HealthPlanListItem["steps"],
    stats: stats(s),
    ...over,
  };
}

const step = (id: string, title: string) => ({ id, cattleId: id, title, taskType: "MEDICINE", medicineName: null, dueDateTime: "2026-10-02T06:00:00.000Z", status: "PENDING" });

function renderSheet(target: ProtocolSheetTarget | null, extra: { onApply?: () => void; onManageCase?: (id: string) => void; onOpenChange?: (open: boolean) => void } = {}) {
  const props = { onApply: vi.fn(), onManageCase: vi.fn(), onOpenChange: vi.fn(), ...extra };
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
      <ProtocolSheet target={target} {...props} />
    </NextIntlClientProvider>,
  );
  return props;
}
const tab = (name: string) => screen.getByRole("tab", { name });
// Radix tabs switch on mouse-down, not click
const openTab = (name: string) => fireEvent.mouseDown(tab(name), { button: 0, ctrlKey: false });

describe("ProtocolSheet (RFE-143, RFE-144)", () => {
  beforeEach(() => {
    h.filtersSeen = [];
    h.tasks = { items: [], hasNextPage: false, isLoading: false, isError: false };
  });

  it("renders nothing while no protocol is open", () => {
    renderSheet(null);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens on Progress with the protocol's name, its live counts and three tabs", () => {
    renderSheet({ kind: "plan", plan: plan() });
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Mastitis 5-day")).toBeTruthy();
    expect(screen.getByText("3 animals in progress")).toBeTruthy();
    expect(["Progress", "Steps", "Results"].map((n) => tab(n).getAttribute("aria-selected"))).toEqual(["true", "false", "false"]);
    // the old Due now / Animals tabs are gone — their work is the grid
    expect(screen.queryByRole("tab", { name: "Due now" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Animals" })).toBeNull();
  });

  it("the Progress tab is the grid for this protocol; the sheet itself no longer loads steps", () => {
    renderSheet({ kind: "plan", plan: plan() });
    expect(screen.getByTestId("grid").textContent).toContain("grid-of-p1");
    expect(h.filtersSeen).toHaveLength(0);
  });

  it("opening a case from the grid closes the sheet first, then opens the case", () => {
    const { onOpenChange, onManageCase } = renderSheet({ kind: "plan", plan: plan() });
    fireEvent.click(screen.getByRole("button", { name: "open-case-9" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onManageCase).toHaveBeenCalledWith("case-9");
  });

  it("Steps tab shows the sequence, falling back to the title when a step has no instruction", () => {
    renderSheet({ kind: "plan", plan: plan() });
    openTab("Steps");
    expect(screen.getByText("Inject 5 ml")).toBeTruthy();
    expect(screen.getByText("Rest")).toBeTruthy();
  });

  it("Steps tab handles a protocol with no steps", () => {
    renderSheet({ kind: "plan", plan: plan({ steps: [] }) });
    openTab("Steps");
    expect(screen.getByText("No steps")).toBeTruthy();
  });

  it("Results tab shows the protocol's result tiles", () => {
    renderSheet({ kind: "plan", plan: plan() });
    openTab("Results");
    expect(screen.getByText("Recovery rate")).toBeTruthy();
  });

  it("Apply starts the apply flow for this protocol", () => {
    const p = plan();
    const { onApply } = renderSheet({ kind: "plan", plan: p });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith(p);
  });

  it("a protocol deleted while animals are on it can be read and worked, but not applied again", () => {
    const { onApply } = renderSheet({ kind: "plan", plan: plan({ deletedAt: "2026-10-01T00:00:00.000Z" }) });
    expect(screen.getByText("Deleted")).toBeTruthy();
    const apply = screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    fireEvent.click(apply);
    expect(onApply).not.toHaveBeenCalled();
    // its steps are still there to record
    expect(tab("Progress")).toBeTruthy();
  });

  it("'Not part of a protocol' asks for steps with no protocol and has no tabs or Apply", () => {
    h.tasks.items = [step("a", "Old step")];
    renderSheet({ kind: "loose" });
    expect(screen.getByText("Not part of a protocol")).toBeTruthy();
    expect(h.filtersSeen.at(-1)).toMatchObject({ noPlan: true, sortBy: "due", statuses: ["PENDING", "RESCHEDULED", "OVERDUE"] });
    expect(h.filtersSeen.at(-1)?.dueTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(h.filtersSeen.at(-1)).not.toHaveProperty("healthPlanId");
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
    expect(screen.getAllByTestId("step-card")).toHaveLength(1);
  });

  it("'Not part of a protocol' groups its due steps into step cards", () => {
    h.tasks.items = [step("a", "Old step"), step("b", "Old step"), step("c", "Other")];
    renderSheet({ kind: "loose" });
    expect(screen.getAllByTestId("step-card").map((c) => c.textContent)).toEqual(["Old step x2", "Other x1"]);
  });

  it("'Not part of a protocol' with nothing due says so", () => {
    renderSheet({ kind: "loose" });
    expect(screen.getByText("Nothing due right now")).toBeTruthy();
  });

  it("'Not part of a protocol' warns when the server has more than the first 100", () => {
    h.tasks.items = [step("a", "Old step")];
    h.tasks.hasNextPage = true;
    renderSheet({ kind: "loose" });
    expect(screen.getByText(/Showing the first 100 steps/)).toBeTruthy();
  });

  it("'Not part of a protocol' shows an error with a retry instead of an empty list", () => {
    h.tasks.isError = true;
    renderSheet({ kind: "loose" });
    expect(screen.getByText("Could not load the steps.")).toBeTruthy();
  });
});

const protocolRound = (over: Record<string, unknown> = {}) =>
  ({
    roundKey: "app:r1",
    healthPlan: { id: "p1", name: "FMD vaccine", category: "VACCINATION", deletedAt: null },
    kind: "PREVENTION",
    startDate: "2026-10-02",
    animalCount: 12,
    stepsTotal: 24,
    stepsDone: 9,
    stepsSkipped: 0,
    stepsOverdue: 0,
    stepsDueToday: 0,
    nextDueDate: null,
    status: "RUNNING",
    ...over,
  }) as unknown as ProtocolRound;

describe("ProtocolSheet - one round (RFE-147)", () => {
  beforeEach(() => {
    h.filtersSeen = [];
    h.plan = { data: undefined, isError: false };
  });

  it("the header is the round's: protocol, the day it was applied, animals and steps done", () => {
    renderSheet({ kind: "round", round: protocolRound() });
    expect(screen.getByText("FMD vaccine")).toBeTruthy();
    expect(screen.getByText("Round of Oct 2")).toBeTruthy();
    expect(screen.getByText(/12 animals · 9 of 24 steps done/)).toBeTruthy();
  });

  it("flags what is late and due today, or the next step when nothing is", () => {
    const { unmount } = render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
        <ProtocolSheet target={{ kind: "round", round: protocolRound({ stepsOverdue: 2, stepsDueToday: 1 }) }} onOpenChange={vi.fn()} onApply={vi.fn()} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("2 steps overdue")).toBeTruthy();
    expect(screen.getByText("1 step due today")).toBeTruthy();
    unmount();
    renderSheet({ kind: "round", round: protocolRound({ nextDueDate: "2026-10-09" }) });
    expect(screen.getByText("Next step Oct 9")).toBeTruthy();
  });

  it("a finished round says so and has no due line", () => {
    renderSheet({ kind: "round", round: protocolRound({ status: "FINISHED", stepsOverdue: 3 }) });
    expect(screen.getByText("Finished")).toBeTruthy();
    expect(screen.queryByText("3 steps overdue")).toBeNull();
  });

  it("opens on Progress with this round's grid, and has Progress / Steps / Results", () => {
    renderSheet({ kind: "round", round: protocolRound() });
    expect(["Progress", "Steps", "Results"].map((n) => tab(n).getAttribute("aria-selected"))).toEqual(["true", "false", "false"]);
    expect(screen.getByTestId("round-grid").textContent).toContain("round-grid-of-app:r1");
    // the round sheet reads no steps of its own
    expect(h.filtersSeen).toHaveLength(0);
  });

  it("opening a case from the grid closes the sheet first, then opens the case", () => {
    const { onOpenChange, onManageCase } = renderSheet({ kind: "round", round: protocolRound() });
    fireEvent.click(screen.getByRole("button", { name: "open-case-7" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onManageCase).toHaveBeenCalledWith("case-7");
  });

  it("Steps and Results are the protocol's own, once it has loaded", () => {
    h.plan = { data: plan(), isError: false };
    renderSheet({ kind: "round", round: protocolRound() });
    openTab("Steps");
    expect(screen.getByText("Inject 5 ml")).toBeTruthy();
    openTab("Results");
    expect(screen.getByText("Recovery rate")).toBeTruthy();
  });

  it("while the protocol loads, Steps shows a placeholder rather than an error", () => {
    renderSheet({ kind: "round", round: protocolRound() });
    openTab("Steps");
    expect(screen.queryByText("Inject 5 ml")).toBeNull();
    expect(screen.queryByText("Could not load this protocol's details.")).toBeNull();
  });

  it("shows an error when the protocol cannot be loaded", () => {
    h.plan = { data: undefined, isError: true };
    renderSheet({ kind: "round", round: protocolRound() });
    openTab("Results");
    expect(screen.getByText("Could not load this protocol's details.")).toBeTruthy();
  });

  it("Apply starts a new round of this protocol, once it has loaded", () => {
    const p = plan();
    h.plan = { data: p, isError: false };
    const { onApply } = renderSheet({ kind: "round", round: protocolRound() });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith(p);
  });

  it("Apply waits for the protocol, and is off for one that was deleted", () => {
    const { unmount } = render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
        <ProtocolSheet target={{ kind: "round", round: protocolRound() }} onOpenChange={vi.fn()} onApply={vi.fn()} />
      </NextIntlClientProvider>,
    );
    expect((screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement).disabled).toBe(true);
    unmount();
    h.plan = { data: plan(), isError: false };
    renderSheet({ kind: "round", round: protocolRound({ healthPlan: { id: "p1", name: "FMD vaccine", category: "VACCINATION", deletedAt: "2026-10-01T00:00:00.000Z" } }) });
    expect((screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Deleted")).toBeTruthy();
  });
});

describe("ProtocolSheet - add animals to a round (RFE-148)", () => {
  beforeEach(() => {
    h.plan = { data: undefined, isError: false };
  });

  it("Add animals opens the dialog for this round", () => {
    renderSheet({ kind: "round", round: protocolRound() });
    expect(screen.queryByTestId("add-dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add animals" }));
    expect(screen.getByTestId("add-dialog").textContent).toBe("add-to-app:r1");
  });

  it("works before the protocol itself has loaded (it only needs the round)", () => {
    renderSheet({ kind: "round", round: protocolRound() });
    expect((screen.getByRole("button", { name: "Add animals" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("is off for a round of a deleted protocol", () => {
    renderSheet({ kind: "round", round: protocolRound({ healthPlan: { id: "p1", name: "FMD vaccine", category: "VACCINATION", deletedAt: "2026-10-01T00:00:00.000Z" } }) });
    expect((screen.getByRole("button", { name: "Add animals" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("a protocol-level sheet has no Add animals (it is not one round)", () => {
    renderSheet({ kind: "plan", plan: plan() });
    expect(screen.queryByRole("button", { name: "Add animals" })).toBeNull();
  });
});
