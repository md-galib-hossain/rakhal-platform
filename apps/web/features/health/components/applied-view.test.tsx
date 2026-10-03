import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import type { ProtocolRound } from "../types";
import type { AppliedStatus } from "../round-model";
import { AppliedView } from "./applied-view";

const h = vi.hoisted(() => ({
  running: [] as unknown[],
  finished: [] as unknown[],
  runningLoading: false,
  isError: false,
  hasNextPage: false,
  calls: [] as Array<{ filters: Record<string, unknown>; options?: { enabled?: boolean } }>,
  canUpdate: true,
}));

vi.mock("@/lib/auth/permissions", () => ({ useCan: () => (permission: string) => (permission === "healthcare.update" ? h.canUpdate : true) }));
vi.mock("../hooks/use-health", () => ({
  useRounds: (filters: Record<string, unknown>, options?: { enabled?: boolean }) => {
    h.calls.push({ filters, options });
    const items = filters.status === "FINISHED" ? h.finished : h.running;
    return { data: { items, meta: { hasNextPage: h.hasNextPage } }, isLoading: filters.status === "RUNNING" && h.runningLoading, isError: h.isError, isFetching: false, refetch: vi.fn() };
  },
}));
vi.mock("./round-animals-dialog", () => ({
  RoundAnimalsDialog: ({ round }: { round: { roundKey: string } }) => <div data-testid="add-dialog">{round.roundKey}</div>,
}));

const round = (key: string, name: string, over: Partial<ProtocolRound> = {}): ProtocolRound =>
  ({
    roundKey: key,
    healthPlan: { id: `p-${key}`, name, category: "VACCINATION", deletedAt: null },
    kind: "PREVENTION",
    startDate: "2026-10-02",
    animalCount: 12,
    stepsTotal: 6,
    stepsDone: 1,
    stepsSkipped: 0,
    stepsOverdue: 0,
    stepsDueToday: 0,
    nextDueDate: null,
    status: "RUNNING",
    ...over,
  }) as ProtocolRound;

function renderView(props: Partial<Parameters<typeof AppliedView>[0]> = {}) {
  const onOpen = vi.fn();
  const onStatusChange = vi.fn();
  const onShowLibrary = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
      <AppliedView kind="ALL" search="" status={"needs" as AppliedStatus} onStatusChange={onStatusChange} onOpen={onOpen} onShowLibrary={onShowLibrary} {...props} />
    </NextIntlClientProvider>,
  );
  return { onOpen, onStatusChange, onShowLibrary };
}
/** Body rows of the table (the header row is the first). */
const bodyRows = () => screen.queryAllByRole("row").slice(1);

describe("AppliedView (table)", () => {
  beforeEach(() => {
    h.running = [round("late", "FMD vaccine", { stepsOverdue: 2, stepsDueToday: 1 }), round("today", "Deworming", { stepsDueToday: 3 }), round("later", "Booster plan", { nextDueDate: "2026-10-09" })];
    h.finished = [round("done", "Old vaccine", { status: "FINISHED", stepsDone: 6 })];
    h.runningLoading = false;
    h.isError = false;
    h.hasNextPage = false;
    h.calls = [];
    h.canUpdate = true;
  });

  it("offers one status choice with counts, instead of separate Late only and Finished switches", () => {
    renderView();
    const group = screen.getByRole("radiogroup", { name: "Show" });
    const labels = within(group).getAllByRole("radio").map((r) => r.textContent);
    expect(labels).toEqual(["Needs action2", "Upcoming1", "Finished", "All3"]);
    expect(screen.queryByRole("switch")).toBeNull();
    expect(within(group).getByRole("radio", { name: /Needs action/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("is a table with the protocol, started, animals, progress and status columns", () => {
    renderView();
    const heads = screen.getAllByRole("columnheader").map((c) => c.textContent);
    expect(heads.slice(0, 5)).toEqual(["Protocol", "Started", "Animals", "Progress", "Status"]);
  });

  it("Needs action lists rounds with a late or due-today step, most late first", () => {
    renderView();
    const rows = bodyRows();
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("FMD vaccine")).toBeTruthy();
    expect(within(rows[1]).getByText("Deworming")).toBeTruthy();
  });

  it("Upcoming lists the rest", () => {
    renderView({ status: "upcoming" });
    expect(screen.getByText("Booster plan")).toBeTruthy();
    expect(screen.queryByText("FMD vaccine")).toBeNull();
    expect(screen.getByText("Next step Oct 9")).toBeTruthy();
  });

  it("All lists everything running; Finished asks for finished rounds only when chosen", () => {
    renderView({ status: "all" });
    expect(bodyRows()).toHaveLength(3);
    expect(h.calls.find((c) => c.filters.status === "FINISHED")?.options).toEqual({ enabled: false });
  });

  it("Finished lists finished rounds, with no Add animals", () => {
    renderView({ status: "finished" });
    expect(h.calls.find((c) => c.filters.status === "FINISHED")?.options).toEqual({ enabled: true });
    expect(screen.getByText("Old vaccine")).toBeTruthy();
    expect(within(bodyRows()[0]).getByText("Finished")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add animals" })).toBeNull();
  });

  it("choosing a status tells the caller (it keeps it in the URL)", () => {
    const { onStatusChange } = renderView();
    fireEvent.click(screen.getByRole("radio", { name: /Finished/ }));
    expect(onStatusChange).toHaveBeenCalledWith("finished");
  });

  it("a row shows the protocol, start day, animals, progress and what is late or due", () => {
    renderView();
    const row = screen.getByText("FMD vaccine").closest("tr") as HTMLElement;
    const cells = within(row).getAllByRole("cell");
    expect(cells[1].textContent).toBe("Oct 2");
    expect(cells[2].textContent).toBe("12");
    expect(cells[3].textContent).toContain("1 of 6 steps done");
    expect(within(row).getByText("2 steps overdue")).toBeTruthy();
    expect(within(row).getByText("1 step due today")).toBeTruthy();
  });

  it("clicking Details or a row opens the full round sheet", () => {
    const { onOpen } = renderView();
    fireEvent.click(screen.getAllByRole("button", { name: "Details" })[0]);
    expect(onOpen).toHaveBeenLastCalledWith(expect.objectContaining({ roundKey: "late" }));
    fireEvent.click(screen.getByText("Deworming").closest("tr") as HTMLElement);
    expect(onOpen).toHaveBeenLastCalledWith(expect.objectContaining({ roundKey: "today" }));
  });

  it("Add animals opens the dialog for that row without opening the sheet", () => {
    const { onOpen } = renderView();
    fireEvent.click(screen.getAllByRole("button", { name: "Add animals" })[0]);
    expect(screen.getByTestId("add-dialog").textContent).toBe("late");
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("a worker sees no Add animals", () => {
    h.canUpdate = false;
    renderView();
    expect(screen.queryByRole("button", { name: "Add animals" })).toBeNull();
    expect(screen.getByText("FMD vaccine")).toBeTruthy();
  });

  it("a protocol deleted while animals are on it is flagged and cannot take more animals", () => {
    h.running = [round("gone", "Old plan", { stepsOverdue: 1, healthPlan: { id: "p", name: "Old plan", category: "VACCINATION", deletedAt: "2026-10-01" } as ProtocolRound["healthPlan"] })];
    renderView();
    expect(screen.getByText("Deleted")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add animals" })).toBeNull();
  });

  it("pages a long list: 20 rows by default, with a pager", () => {
    h.running = Array.from({ length: 25 }, (_, i) => round(`r${i}`, `Protocol ${String(i).padStart(2, "0")}`, { stepsDueToday: 1 }));
    renderView();
    expect(bodyRows()).toHaveLength(20);
    expect(screen.getByRole("button", { name: "Next page" })).toBeTruthy();
  });

  it("no pager for a short list", () => {
    renderView();
    expect(screen.queryByRole("button", { name: "Next page" })).toBeNull();
  });

  it("Needs action with nothing to do says so and offers All", () => {
    h.running = [round("later", "Booster plan", { nextDueDate: "2026-10-09" })];
    const { onStatusChange } = renderView();
    expect(screen.getByText("Nothing needs action")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(onStatusChange).toHaveBeenCalledWith("all");
  });

  it("nothing applied at all sends you to the Library", () => {
    h.running = [];
    const { onShowLibrary } = renderView({ status: "all" });
    fireEvent.click(screen.getByRole("button", { name: "Open the Library" }));
    expect(onShowLibrary).toHaveBeenCalled();
  });

  it("sends the page's kind and search to the server", () => {
    renderView({ kind: "PREVENTION", search: "fmd" });
    expect(h.calls[0].filters).toEqual({ status: "RUNNING", kind: "PREVENTION", search: "fmd" });
  });

  it("a load error says so", () => {
    h.isError = true;
    renderView();
    expect(screen.getByText("Could not load the rounds.")).toBeTruthy();
  });

  it("warns when only the first 100 are shown", () => {
    h.hasNextPage = true;
    renderView();
    expect(screen.getByText("Showing the first 100 rounds.")).toBeTruthy();
  });

  it("shows no empty state while loading", () => {
    h.runningLoading = true;
    renderView();
    expect(screen.queryByText("Nothing needs action")).toBeNull();
    expect(screen.queryAllByRole("row")).toHaveLength(0);
  });
});
