import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import type { HealthPlanListItem, HealthTask } from "../types";
import { ProtocolProgressGrid } from "./protocol-progress-grid";

const h = vi.hoisted(() => ({
  items: [] as unknown[],
  truncated: false,
  isLoading: false,
  isError: false,
  canUpdate: true,
}));

vi.mock("@/lib/auth/permissions", () => ({
  useCan: () => (permission: string) => (permission === "healthcare.update" ? h.canUpdate : true),
}));
vi.mock("../hooks/use-health", () => ({
  useProtocolTasks: () => ({ data: { items: h.items, truncated: h.truncated }, isLoading: h.isLoading, isError: h.isError, refetch: vi.fn() }),
}));
vi.mock("@/components/shared/animal-link", () => ({
  AnimalLink: ({ animalName, tagNumber }: { animalName?: string | null; tagNumber?: string | null }) => <span>{animalName ?? tagNumber}</span>,
}));
vi.mock("./record-batch-dialog", () => ({
  RecordBatchDialog: ({ group }: { group?: { tasks: Array<{ id: string }> } }) => (group ? <div data-testid="record">{group.tasks.map((t) => t.id).join(",")}</div> : null),
}));
vi.mock("./task-reschedule-dialog", () => ({
  TaskRescheduleDialog: ({ group }: { group?: { tasks: Array<{ id: string }> } }) => (group ? <div data-testid="reschedule">{group.tasks.map((t) => t.id).join(",")}</div> : null),
}));
vi.mock("./skip-task-dialog", () => ({
  SkipTaskDialog: ({ task }: { task: { id: string } | null }) => (task ? <div data-testid="skip">{task.id}</div> : null),
}));

/** `n` days from today at noon, local. */
const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
};

const plan = {
  id: "p1",
  name: "FMD vaccine",
  steps: [
    { id: "s1", dayNumber: 0, title: "First dose", instruction: null },
    { id: "s2", dayNumber: 2, title: "Booster", instruction: null },
  ],
} as unknown as HealthPlanListItem;

const t = (id: string, cow: string, stepNumber: number, due: number, status: HealthTask["status"] = "PENDING", extra: Partial<HealthTask> = {}) =>
  ({
    id,
    cattleId: `c-${cow}`,
    healthCaseId: null,
    planEnrollmentId: `e-${cow}`,
    dueDateTime: inDays(due),
    taskDate: inDays(due),
    status,
    taskType: "MEDICINE",
    title: stepNumber === 1 ? "First dose" : "Booster",
    instruction: null,
    stepNumber,
    medicineName: "Ceftriaxone",
    doseAmount: 5,
    doseUnit: "ml",
    completedAt: status === "COMPLETED" ? inDays(due) : null,
    cattle: { id: `c-${cow}`, tagNumber: `TAG-${cow}`, name: cow },
    ...extra,
  }) as unknown as HealthTask;

/** The screenshot scenario: 2 cows, 2 steps. Bhola: dose done, booster 4 days late. Tuni: dose due today, booster in 2 days. */
const screenshotTasks = () => [t("b1", "Bhola", 1, -4, "COMPLETED"), t("b2", "Bhola", 2, -4), t("u1", "Tuni", 1, 0), t("u2", "Tuni", 2, 2)];

function renderGrid(onManageCase = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
      <ProtocolProgressGrid plan={plan} onManageCase={onManageCase} />
    </NextIntlClientProvider>,
  );
  return { onManageCase };
}

const rowOf = (name: string) => screen.getByRole("rowheader", { name: new RegExp(name) }).closest("tr")!;

describe("ProtocolProgressGrid (RFE-144)", () => {
  beforeEach(() => {
    h.items = screenshotTasks();
    h.truncated = false;
    h.isLoading = false;
    h.isError = false;
    h.canUpdate = true;
  });

  it("shows every animal as a row and every step as a column, with each cell's state", () => {
    renderGrid();
    expect(screen.getByRole("columnheader", { name: /Day 0/ })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: /Day 2/ })).toBeTruthy();
    const bhola = within(rowOf("Bhola"));
    expect(bhola.getByText(/^Done/)).toBeTruthy();
    expect(bhola.getByText("4 days late")).toBeTruthy();
    const tuni = within(rowOf("Tuni"));
    expect(tuni.getByText("Today")).toBeTruthy();
  });

  it("puts the most urgent animal first", () => {
    renderGrid();
    const names = screen.getAllByRole("rowheader").map((r) => r.textContent);
    expect(names[0]).toContain("Bhola"); // she has the late step
  });

  it("Due only keeps just the animals with something due, and says how many are shown", () => {
    h.items = [...screenshotTasks(), t("k1", "Kali", 1, 5), t("k2", "Kali", 2, 7)];
    renderGrid();
    expect(screen.getByText("Showing 3 of 3 animals")).toBeTruthy();
    fireEvent.click(screen.getByRole("switch", { name: "Due only" }));
    expect(screen.getByText("Showing 2 of 3 animals")).toBeTruthy();
    expect(screen.queryByRole("rowheader", { name: /Kali/ })).toBeNull();
  });

  it("Due only with nothing due offers to show everyone again", () => {
    h.items = [t("k1", "Kali", 1, 5), t("k2", "Kali", 2, 7)];
    renderGrid();
    fireEvent.click(screen.getByRole("switch", { name: "Due only" }));
    expect(screen.getByText("Nothing due right now")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show all animals" }));
    expect(screen.getByRole("rowheader", { name: /Kali/ })).toBeTruthy();
  });

  it("the column header records everything due in that step, not the rest", () => {
    renderGrid();
    // Day 0 column: only Tuni's dose is due (Bhola's is done)
    fireEvent.click(screen.getByRole("button", { name: "Record all (1) — First dose" }));
    expect(screen.getByTestId("record").textContent).toBe("u1");
  });

  it("no 'Record all' on a column with nothing due", () => {
    h.items = [t("k1", "Kali", 1, 5), t("k2", "Kali", 2, 7)];
    renderGrid();
    expect(screen.queryByRole("button", { name: /Record all/ })).toBeNull();
  });

  it("an animal on a sickness case opens that case", () => {
    h.items = [t("c1", "Lokkhi", 1, 0, "PENDING", { healthCaseId: "case-7", planEnrollmentId: null })];
    const { onManageCase } = renderGrid();
    fireEvent.click(screen.getByRole("button", { name: "Lokkhi" }));
    expect(onManageCase).toHaveBeenCalledWith("case-7");
  });

  it("an empty protocol says to apply it", () => {
    h.items = [];
    renderGrid();
    expect(screen.getByText("No animal is on this protocol")).toBeTruthy();
  });

  it("warns when the protocol has more steps than the grid reads", () => {
    h.truncated = true;
    renderGrid();
    expect(screen.getByText(/Showing the first 4 steps/)).toBeTruthy();
  });

  it("shows an error with a retry instead of an empty grid", () => {
    h.isError = true;
    renderGrid();
    expect(screen.getByText("Could not load the steps.")).toBeTruthy();
  });
});

describe("ProtocolProgressGrid — cell actions (RFE-145)", () => {
  beforeEach(() => {
    h.items = screenshotTasks();
    h.truncated = false;
    h.isLoading = false;
    h.isError = false;
    h.canUpdate = true;
  });

  const openCell = (animal: string, text: string) => fireEvent.click(within(rowOf(animal)).getByText(text).closest("button")!);

  it("a late cell offers Record, Reschedule and Skip for that one step", () => {
    renderGrid();
    openCell("Bhola", "4 days late");
    expect(screen.getByRole("button", { name: "Record" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reschedule" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Skip this step" })).toBeTruthy();
  });

  it("Record opens the record dialog with just that animal's step", () => {
    renderGrid();
    openCell("Bhola", "4 days late");
    fireEvent.click(screen.getByRole("button", { name: "Record" }));
    expect(screen.getByTestId("record").textContent).toBe("b2");
  });

  it("Reschedule opens the reschedule dialog with just that step", () => {
    renderGrid();
    openCell("Tuni", "Today");
    fireEvent.click(screen.getByRole("button", { name: "Reschedule" }));
    expect(screen.getByTestId("reschedule").textContent).toBe("u1");
  });

  it("Skip opens the skip dialog for that step", () => {
    renderGrid();
    openCell("Bhola", "4 days late");
    fireEvent.click(screen.getByRole("button", { name: "Skip this step" }));
    expect(screen.getByTestId("skip").textContent).toBe("b2");
  });

  it("a future step can be moved or skipped but not recorded early", () => {
    renderGrid();
    const upcoming = within(rowOf("Tuni"))
      .getAllByRole("button")
      .find((b) => !/Today/.test(b.textContent ?? ""))!;
    fireEvent.click(upcoming);
    expect(screen.queryByRole("button", { name: "Record" })).toBeNull();
    expect(screen.getByRole("button", { name: "Reschedule" })).toBeTruthy();
  });

  it("a finished step is plain text, not a button", () => {
    renderGrid();
    expect(within(rowOf("Bhola")).getByText(/^Done/).closest("button")).toBeNull();
  });

  it("without healthcare.update the grid reads but nothing can be changed", () => {
    h.canUpdate = false;
    renderGrid();
    expect(within(rowOf("Bhola")).getByText("4 days late")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Record all/ })).toBeNull();
    expect(within(rowOf("Bhola")).queryByRole("button")).toBeNull();
  });
});
