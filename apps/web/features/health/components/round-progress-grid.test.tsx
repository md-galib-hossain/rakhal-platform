import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import type { ProtocolRound, RoundGridCell, RoundGridRow } from "../types";
import { RoundProgressGrid } from "./round-progress-grid";

const h = vi.hoisted(() => ({
  pages: [] as unknown[],
  hasNextPage: false,
  isLoading: false,
  isError: false,
  isFetchingNextPage: false,
  canUpdate: true,
  fetchNextPage: vi.fn(),
  gridArgs: [] as Array<[string | undefined, boolean]>,
  loaderCalls: [] as string[][],
  loaderResult: [] as unknown[],
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  remove: vi.fn(),
  phone: false,
}));

vi.mock("@/lib/hooks/use-media-query", () => ({ useMediaQuery: () => h.phone }));

vi.mock("sonner", () => ({ toast: { error: (message: string) => h.toastError(message), success: (message: string) => h.toastSuccess(message) } }));
vi.mock("@/lib/auth/permissions", () => ({
  useCan: () => (permission: string) => (permission === "healthcare.update" ? h.canUpdate : true),
}));
vi.mock("../hooks/use-health", () => ({
  useRoundGrid: (roundKey: string | undefined, dueOnly: boolean) => {
    h.gridArgs.push([roundKey, dueOnly]);
    return {
      data: { pages: h.pages },
      hasNextPage: h.hasNextPage,
      fetchNextPage: h.fetchNextPage,
      isLoading: h.isLoading,
      isError: h.isError,
      isFetchingNextPage: h.isFetchingNextPage,
      refetch: vi.fn(),
    };
  },
  useRemoveFromRound: () => ({ mutateAsync: h.remove }),
  useProtocolTaskLoader: () => async (ids: string[]) => {
    h.loaderCalls.push(ids);
    return h.loaderResult;
  },
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

const round = {
  roundKey: "app:r1",
  healthPlan: { id: "p1", name: "FMD vaccine", category: "VACCINATION", deletedAt: null },
  kind: "PREVENTION",
  startDate: "2026-10-02",
  animalCount: 12,
  stepsTotal: 6,
  stepsDone: 1,
  stepsSkipped: 0,
  stepsOverdue: 1,
  stepsDueToday: 1,
  nextDueDate: "2026-09-28",
  status: "RUNNING",
} as unknown as ProtocolRound;

const cell = (taskId: string, state: RoundGridCell["state"], days = 0, stepNumber = 1): RoundGridCell => ({
  taskId,
  state,
  days,
  title: stepNumber === 1 ? "First dose" : "Booster",
  status: state === "done" ? "COMPLETED" : state === "overdue" ? "OVERDUE" : "PENDING",
  stepNumber,
  dueDate: "2026-10-02T06:00:00.000Z",
  doneAt: state === "done" ? "2026-10-02T06:00:00.000Z" : null,
});
const row = (runKey: string, name: string, cells: Record<string, RoundGridCell>, over: Partial<RoundGridRow> = {}): RoundGridRow => ({
  runKey,
  runType: "ENROLLMENT",
  healthCaseId: null,
  planEnrollmentId: runKey,
  caseCode: null,
  cattle: { id: `c-${runKey}`, name, tagNumber: `TAG-${name}` },
  dueCount: Object.values(cells).filter((c) => c.state === "overdue" || c.state === "today").length,
  overdueCount: Object.values(cells).filter((c) => c.state === "overdue").length,
  cells,
  ...over,
});
const columns = [
  { key: "s1", stepNumber: 1, dayNumber: 0, title: "First dose" },
  { key: "s2", stepNumber: 2, dayNumber: 2, title: "Booster" },
];
const page = (rows: RoundGridRow[]) => ({ data: { round, columns, rows }, meta: { hasNextPage: false, endCursor: null } });
/** The screenshot scenario plus a sold animal: Bhola (case) dose done / booster 4 days late; Tuni dose today / booster upcoming; Kali not active. */
const scenario = () =>
  page([
    row("b", "Bhola", { s1: cell("b1", "done"), s2: cell("b2", "overdue", -4, 2) }, { runType: "CASE", healthCaseId: "case-1", planEnrollmentId: null }),
    row("u", "Tuni", { s1: cell("u1", "today"), s2: cell("u2", "upcoming", 2, 2) }),
    row("k", "Kali", { s1: cell("k1", "inactive", -2) }),
  ]);

const fullTask = (id: string) => ({ id, title: "Booster", taskType: "MEDICINE", status: "PENDING", dueDateTime: "2026-10-02T06:00:00.000Z", cattleId: "x", cattle: { name: "Bhola", tagNumber: "TAG-Bhola" } });

function renderGrid(onManageCase = vi.fn(), extra: { layout?: "auto" | "cards"; dueOnly?: boolean } = {}) {
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
      <RoundProgressGrid round={round} onManageCase={onManageCase} {...extra} />
    </NextIntlClientProvider>,
  );
  return { onManageCase };
}
const rowOf = (name: string) => screen.getByRole("rowheader", { name: new RegExp(name) }).closest("tr")!;
const openCell = (animal: string, text: string) => fireEvent.click(within(rowOf(animal)).getByText(text).closest("button")!);

describe("RoundProgressGrid (RFE-147)", () => {
  beforeEach(() => {
    h.pages = [scenario()];
    h.hasNextPage = false;
    h.isLoading = false;
    h.isError = false;
    h.isFetchingNextPage = false;
    h.canUpdate = true;
    h.fetchNextPage.mockReset();
    h.gridArgs = [];
    h.loaderCalls = [];
    h.loaderResult = [];
    h.toastError.mockReset();
    h.toastSuccess.mockReset();
    h.remove.mockReset().mockResolvedValue({});
    h.phone = false;
  });

  it("asks the server for this round's grid, and for due-only when the switch is on", () => {
    renderGrid();
    expect(h.gridArgs.at(-1)).toEqual(["app:r1", false]);
    fireEvent.click(screen.getByRole("switch", { name: "Due only" }));
    expect(h.gridArgs.at(-1)).toEqual(["app:r1", true]);
  });

  it("draws every animal as a row and every step as a column, with the server's state in each cell", () => {
    renderGrid();
    expect(screen.getByRole("columnheader", { name: /Day 0/ })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: /Day 2/ })).toBeTruthy();
    expect(within(rowOf("Bhola")).getByText(/^Done/)).toBeTruthy();
    expect(within(rowOf("Bhola")).getByText("4 days late")).toBeTruthy();
    expect(within(rowOf("Tuni")).getByText("Today")).toBeTruthy();
  });

  it("an inactive step (the animal left the herd) is shown as such and cannot be acted on", () => {
    renderGrid();
    expect(within(rowOf("Kali")).getByText("Not active")).toBeTruthy();
    expect(within(rowOf("Kali")).getByText("Not active").closest("button")).toBeNull();
  });

  it("says how many animals are shown out of the round", () => {
    renderGrid();
    expect(screen.getByText("Showing 3 of 12 animals")).toBeTruthy();
  });

  it("an animal on a sickness case opens that case; any other row opens the animal", () => {
    const { onManageCase } = renderGrid();
    fireEvent.click(screen.getByRole("button", { name: "Bhola" }));
    expect(onManageCase).toHaveBeenCalledWith("case-1");
    expect(screen.getByText("Tuni").closest("button")).toBeNull();
  });

  it("a column's Record all covers just that step's due cells, and loads their full steps", async () => {
    h.loaderResult = [fullTask("u1")];
    renderGrid();
    fireEvent.click(screen.getByRole("button", { name: "Record all (1) — First dose" }));
    await waitFor(() => expect(screen.getByTestId("record").textContent).toBe("u1"));
    expect(h.loaderCalls.at(-1)).toEqual(["u1"]);
  });

  it("a cell's Record loads that one step and opens the record dialog for it", async () => {
    h.loaderResult = [fullTask("b2")];
    renderGrid();
    openCell("Bhola", "4 days late");
    fireEvent.click(screen.getByRole("button", { name: "Record" }));
    await waitFor(() => expect(screen.getByTestId("record").textContent).toBe("b2"));
    expect(h.loaderCalls.at(-1)).toEqual(["b2"]);
  });

  it("Reschedule and Skip open their dialogs for that step", async () => {
    h.loaderResult = [fullTask("u1")];
    renderGrid();
    openCell("Tuni", "Today");
    fireEvent.click(screen.getByRole("button", { name: "Reschedule" }));
    await waitFor(() => expect(screen.getByTestId("reschedule").textContent).toBe("u1"));
    openCell("Tuni", "Today");
    fireEvent.click(screen.getByRole("button", { name: "Skip this step" }));
    await waitFor(() => expect(screen.getByTestId("skip").textContent).toBe("u1"));
  });

  it("when the step cannot be loaded it says so instead of opening an empty dialog", async () => {
    h.loaderResult = [];
    renderGrid();
    openCell("Bhola", "4 days late");
    fireEvent.click(screen.getByRole("button", { name: "Record" }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith(en.health.healthPlan.sheet.progress.taskNotLoaded));
    expect(screen.queryByTestId("record")).toBeNull();
  });

  it("pages by animal: a 'Show more animals' button only while the server has more", () => {
    renderGrid();
    expect(screen.queryByRole("button", { name: "Show more animals" })).toBeNull();
  });

  it("'Show more animals' fetches the next page", () => {
    h.hasNextPage = true;
    renderGrid();
    fireEvent.click(screen.getByRole("button", { name: "Show more animals" }));
    expect(h.fetchNextPage).toHaveBeenCalled();
  });

  it("rows from every loaded page are shown together", () => {
    h.pages = [page([row("a", "Anna", { s1: cell("a1", "upcoming", 3) })]), page([row("z", "Zoya", { s1: cell("z1", "upcoming", 3) })])];
    renderGrid();
    expect(screen.getByRole("rowheader", { name: /Anna/ })).toBeTruthy();
    expect(screen.getByRole("rowheader", { name: /Zoya/ })).toBeTruthy();
  });

  it("without healthcare.update the grid reads but nothing can be changed", () => {
    h.canUpdate = false;
    renderGrid();
    expect(within(rowOf("Bhola")).getByText("4 days late")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Record all/ })).toBeNull();
    expect(within(rowOf("Tuni")).queryByRole("button")).toBeNull();
  });

  it("a round with no animals says to apply the protocol", () => {
    h.pages = [page([])];
    renderGrid();
    expect(screen.getByText("No animal is on this protocol")).toBeTruthy();
  });

  it("Due only with nothing due offers to show everyone again", () => {
    renderGrid();
    h.pages = [page([])];
    fireEvent.click(screen.getByRole("switch", { name: "Due only" }));
    expect(screen.getByText("Nothing due right now")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show all animals" }));
    expect(h.gridArgs.at(-1)).toEqual(["app:r1", false]);
  });

  it("shows an error with a retry instead of an empty grid", () => {
    h.isError = true;
    renderGrid();
    expect(screen.getByText("Could not load the steps.")).toBeTruthy();
  });

  describe("take an animal off the round (RFE-148)", () => {
    const lastButton = (name: string) => screen.getAllByRole("button", { name }).at(-1)!;

    it("every animal row has a remove button", () => {
      renderGrid();
      expect(screen.getByRole("button", { name: "Remove Tuni from this round" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Remove Bhola from this round" })).toBeTruthy();
    });

    it("asks first, then removes a preventive animal by its enrollment", async () => {
      renderGrid();
      fireEvent.click(screen.getByRole("button", { name: "Remove Tuni from this round" }));
      expect(await screen.findByText("Remove from FMD vaccine?")).toBeTruthy();
      expect(screen.getByText(/Other animals on the round are not affected/)).toBeTruthy();
      expect(h.remove).not.toHaveBeenCalled();
      fireEvent.click(lastButton("Remove from protocol"));
      await waitFor(() => expect(h.remove).toHaveBeenCalledWith({ cattleId: "c-u", dto: { planEnrollmentId: "u" } }));
      await waitFor(() => expect(h.toastSuccess).toHaveBeenCalledWith(en.health.cattleProtocols.removedToast));
    });

    it("removes a treatment animal by its case, and says the case stays open", async () => {
      renderGrid();
      fireEvent.click(screen.getByRole("button", { name: "Remove Bhola from this round" }));
      expect(await screen.findByText(/The sickness case stays open/)).toBeTruthy();
      fireEvent.click(lastButton("Remove from protocol"));
      await waitFor(() => expect(h.remove).toHaveBeenCalledWith({ cattleId: "c-b", dto: { healthCaseId: "case-1" } }));
    });

    it("a failed removal says so", async () => {
      h.remove.mockRejectedValue(new Error("boom"));
      renderGrid();
      fireEvent.click(screen.getByRole("button", { name: "Remove Tuni from this round" }));
      await screen.findByText("Remove from FMD vaccine?");
      fireEvent.click(lastButton("Remove from protocol"));
      await waitFor(() => expect(h.toastError).toHaveBeenCalledWith(en.health.cattleProtocols.genericError));
    });

    it("without healthcare.update there is no remove button", () => {
      h.canUpdate = false;
      renderGrid();
      expect(screen.queryByRole("button", { name: /Remove .* from this round/ })).toBeNull();
    });
  });

  describe("phone layout (RFE-149)", () => {
    beforeEach(() => {
      h.phone = true;
    });

    it("lists animals as cards, not a table, and starts with Due only on", () => {
      renderGrid();
      expect(screen.queryByRole("table")).toBeNull();
      expect(h.gridArgs.at(-1)).toEqual(["app:r1", true]);
      expect(screen.getByRole("switch", { name: "Due only" }).getAttribute("aria-checked")).toBe("true");
    });

    it("the user's own Due only choice wins over the phone default", () => {
      renderGrid();
      fireEvent.click(screen.getByRole("switch", { name: "Due only" }));
      expect(h.gridArgs.at(-1)).toEqual(["app:r1", false]);
    });

    it("layout=cards gives cards on a wide screen too (the Applied list)", () => {
      h.phone = false;
      renderGrid(vi.fn(), { layout: "cards" });
      expect(screen.queryByRole("table")).toBeNull();
      expect(screen.getByRole("button", { name: "Show steps of Bhola" })).toBeTruthy();
    });

    it("a controlled dueOnly is sent to the server as is, and the grid's own switch is gone", () => {
      h.phone = false;
      renderGrid(vi.fn(), { layout: "cards", dueOnly: true });
      expect(h.gridArgs.at(-1)).toEqual(["app:r1", true]);
      expect(screen.queryByRole("switch", { name: "Due only" })).toBeNull();
    });

    it("a controlled dueOnly with nobody due says so, without a Show all button of its own", () => {
      h.phone = false;
      h.pages = [page([])];
      renderGrid(vi.fn(), { layout: "cards", dueOnly: true });
      expect(screen.getByText("Nothing due right now")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Show all animals" })).toBeNull();
    });

    it("a wide screen keeps the table and Due only off", () => {
      h.phone = false;
      renderGrid();
      expect(screen.getByRole("table")).toBeTruthy();
      expect(h.gridArgs.at(-1)).toEqual(["app:r1", false]);
    });

    it("each card summarises its animal: late, due, and how many steps are done", () => {
      renderGrid();
      expect(screen.getByText("1 late")).toBeTruthy();
      expect(screen.getByText("1 due")).toBeTruthy();
      expect(screen.getByText("1 of 2 done")).toBeTruthy();
    });

    it("each card shows the step to do next; the chevron opens every step", () => {
      renderGrid();
      // Bhola: dose done, booster 4 days late -> the card offers the booster, not the finished dose
      expect(screen.getByText("4 days late")).toBeTruthy();
      expect(screen.queryByText(/^Done/)).toBeNull();
      const toggle = screen.getByRole("button", { name: "Show steps of Bhola" });
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      fireEvent.click(toggle);
      expect(screen.getByRole("button", { name: "Hide steps of Bhola" }).getAttribute("aria-expanded")).toBe("true");
      expect(screen.getByText(/^Done/)).toBeTruthy();
      expect(screen.getByText("4 days late")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Hide steps of Bhola" }));
      expect(screen.queryByText(/^Done/)).toBeNull();
    });

    it("the next step is acted on from the closed card, no need to open it", async () => {
      h.loaderResult = [fullTask("b2")];
      renderGrid();
      fireEvent.click(screen.getByText("4 days late").closest("button")!);
      fireEvent.click(await screen.findByText("Record"));
      await waitFor(() => expect(screen.getByTestId("record").textContent).toBe("b2"));
    });

    it("an animal with nothing left shows All steps done, one that left the herd shows Not active", () => {
      h.pages = [
        page([
          row("d", "Done", { s1: cell("d1", "done"), s2: cell("d2", "done", 0, 2) }),
          row("k", "Kali", { s1: cell("k1", "inactive", -2) }),
        ]),
      ];
      renderGrid();
      expect(screen.getByText("All steps done")).toBeTruthy();
      expect(screen.getByText("Not active")).toBeTruthy();
    });

    it("has one Record button per step that has animals due, naming the step and the count", () => {
      renderGrid();
      expect(screen.getByRole("button", { name: "Record all (1) — First dose" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Record all (1) — Booster" })).toBeTruthy();
    });

    it("a step is acted on from its card, same menu as the table", async () => {
      h.loaderResult = [fullTask("b2")];
      renderGrid();
      fireEvent.click(screen.getByRole("button", { name: "Show steps of Bhola" }));
      fireEvent.click(screen.getByText("4 days late").closest("button")!);
      fireEvent.click(await screen.findByText("Record"));
      await waitFor(() => expect(screen.getByTestId("record").textContent).toBe("b2"));
    });

    it("removing from a card asks first, with the same wording", async () => {
      renderGrid();
      fireEvent.click(screen.getByRole("button", { name: "Remove Tuni from this round" }));
      expect(await screen.findByText("Remove from FMD vaccine?")).toBeTruthy();
    });

    it("a worker sees the cards without the remove button", () => {
      h.canUpdate = false;
      renderGrid();
      expect(screen.queryByRole("button", { name: /Remove .* from this round/ })).toBeNull();
      expect(screen.getByRole("button", { name: "Show steps of Bhola" })).toBeTruthy();
    });
  });
});
