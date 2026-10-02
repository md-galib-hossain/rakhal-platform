import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import type { HealthPlanListItem, HealthPlanStats } from "../types";
import { byUrgency, HealthPlanTab } from "./health-plan-tab";

// Radix select measures with ResizeObserver, which jsdom lacks.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const h = vi.hoisted(() => ({
  loose: { items: [] as unknown[], hasNextPage: false },
  filtersSeen: [] as Array<Record<string, unknown>>,
  page: { items: [] as unknown[], totalPages: 1, goToPage: vi.fn(), isLoading: false, isError: false },
  rounds: { items: [] as unknown[], isLoading: false, isError: false },
  roundFilters: [] as Array<Record<string, unknown>>,
}));

vi.mock("../hooks/use-health", () => ({
  useRounds: (filters: Record<string, unknown>) => {
    h.roundFilters.push(filters);
    return { data: { items: h.rounds.items, meta: { hasNextPage: false } }, isSuccess: !h.rounds.isLoading && !h.rounds.isError, isError: h.rounds.isError, isLoading: h.rounds.isLoading };
  },
  useHealthTasks: () => ({ data: { items: h.loose.items, meta: { hasNextPage: h.loose.hasNextPage } } }),
  useHealthPlansPagedList: (filters: Record<string, unknown>) => {
    h.filtersSeen.push(filters);
    return {
      items: h.page.items,
      page: 1,
      totalPages: h.page.totalPages,
      pageSize: 10,
      setPageSize: vi.fn(),
      goToPage: h.page.goToPage,
      isLoading: h.page.isLoading,
      isError: h.page.isError,
      isFetching: false,
      refetch: vi.fn(),
    };
  },
}));
vi.mock("./rounds-view", () => ({
  RoundsView: ({ kind, search, finished, onOpen, onShowLibrary }: { kind: string; search: string; finished: boolean; onOpen: (round: unknown) => void; onShowLibrary: () => void }) => (
    <div data-testid="rounds-view">
      kind={kind};search={search};finished={String(finished)}
      <button type="button" onClick={() => onOpen({ roundKey: "app:r1", healthPlan: { name: "FMD vaccine" } })}>
        open-round
      </button>
      <button type="button" onClick={onShowLibrary}>
        go-library
      </button>
    </div>
  ),
}));
vi.mock("./health-plan-card", () => ({
  HealthPlanCard: ({ plan, onOpen, runningRounds }: { plan: { id: string; name: string }; onOpen: (p: unknown) => void; runningRounds?: number }) => (
    <div data-testid="card">
      <span>{plan.name}</span>
      <span data-testid="running-count">{runningRounds}</span>
      <button type="button" onClick={() => onOpen(plan)}>
        open-{plan.name}
      </button>
    </div>
  ),
}));
vi.mock("./protocol-sheet", () => ({
  OPEN_STEP_STATUSES: ["PENDING", "RESCHEDULED", "OVERDUE"],
  ProtocolSheet: ({ target }: { target: { kind: string; plan?: { name: string }; round?: { roundKey: string } } | null }) =>
    target ? <div data-testid="sheet">{target.kind === "plan" ? target.plan?.name : target.kind === "round" ? `round:${target.round?.roundKey}` : "loose"}</div> : null,
}));
vi.mock("./create-health-plan-dialog", () => ({ CreateHealthPlanDialog: () => null }));
vi.mock("./apply-health-plan-dialog", () => ({ ApplyHealthPlanDialog: () => null }));
vi.mock("@/components/shared/pagination", () => ({
  Pagination: ({ onPageChange }: { onPageChange: (page: number) => void }) => (
    <button type="button" onClick={() => onPageChange(2)}>
      next-page
    </button>
  ),
}));

const stats = (over: Partial<HealthPlanStats> = {}): HealthPlanStats => ({
  kind: "TREATMENT",
  appliedTo: 1,
  inProgress: 1,
  recovered: null,
  mortality: null,
  recoveryRate: null,
  completed: null,
  due: null,
  coverageRate: null,
  stepsDue: 0,
  stepsOverdue: 0,
  nextDueDate: null,
  ...over,
});
const plan = (name: string, over: Partial<HealthPlanStats> = {}) => ({ id: name, name, stats: stats(over) }) as unknown as HealthPlanListItem;

function renderTab(props: { openRoundKey?: string | null; onRoundOpened?: () => void } = {}) {
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
      <HealthPlanTab {...props} />
    </NextIntlClientProvider>,
  );
}
const lastFilters = () => h.filtersSeen.at(-1) ?? {};

describe("HealthPlanTab — one list of protocols (RFE-142)", () => {
  beforeEach(() => {
    h.filtersSeen = [];
    h.loose = { items: [], hasNextPage: false };
    h.page = { items: [], totalPages: 1, goToPage: vi.fn(), isLoading: false, isError: false };
    h.rounds = { items: [], isLoading: false, isError: false };
    h.roundFilters = [];
  });

  it("has no In use | All switch: it asks the server for every protocol", () => {
    renderTab();
    expect(screen.queryByRole("tab", { name: "In use" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "All protocols" })).toBeNull();
    expect(lastFilters().inUse).toBeUndefined();
  });

  it("the kind chips filter on the server, with no page-sized counts", () => {
    renderTab();
    fireEvent.click(screen.getByRole("radio", { name: "Prevention" }));
    expect(lastFilters()).toMatchObject({ kind: "PREVENTION" });
    fireEvent.click(screen.getByRole("radio", { name: "All" }));
    expect(lastFilters().kind).toBeUndefined();
    // the old chips carried a number that was only the size of the loaded page
    expect(screen.getByRole("radio", { name: "Prevention" }).textContent).toBe("Prevention");
  });

  it("search goes to the server", async () => {
    renderTab();
    fireEvent.change(screen.getByPlaceholderText("Find health plan by name"), { target: { value: "  mast " } });
    await waitFor(() => expect(lastFilters()).toMatchObject({ search: "mast" }));
  });

  it("is ordered most urgent first: overdue, then due today, then the soonest next step", () => {
    h.page.items = [
      plan("Quiet", { nextDueDate: "2026-10-09" }),
      plan("Soon", { nextDueDate: "2026-10-04" }),
      plan("Today", { stepsDue: 2 }),
      plan("Late", { stepsOverdue: 1 }),
      plan("Later", { stepsOverdue: 3 }),
    ];
    renderTab();
    expect(screen.getAllByTestId("card").map((c) => c.firstChild?.textContent)).toEqual(["Later", "Late", "Today", "Soon", "Quiet"]);
  });

  it("a filter with no match offers to clear it", () => {
    renderTab();
    fireEvent.click(screen.getByRole("radio", { name: "Treatment" }));
    expect(screen.getByText("No protocols match")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(lastFilters().kind).toBeUndefined();
  });

  it("an empty library offers to create a protocol", () => {
    renderTab();
    expect(screen.getByText("No health plans")).toBeTruthy();
    // the header button and the empty-state button both create
    expect(screen.getAllByRole("button", { name: "Create New Health Plan" })).toHaveLength(2);
  });

  it("pages when there is more than one page", () => {
    h.page.items = [plan("A")];
    h.page.totalPages = 3;
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "next-page" }));
    expect(h.page.goToPage).toHaveBeenCalledWith(2);
  });

  it("no pager for a single page", () => {
    h.page.items = [plan("A")];
    renderTab();
    expect(screen.queryByRole("button", { name: "next-page" })).toBeNull();
  });

  it("shows an error with a retry instead of an empty list", () => {
    h.page.isError = true;
    renderTab();
    expect(screen.getByText("Could not load health plans.")).toBeTruthy();
  });
});

describe("HealthPlanTab - protocol sheet (RFE-143)", () => {
  beforeEach(() => {
    h.filtersSeen = [];
    h.loose = { items: [], hasNextPage: false };
    h.page = { items: [], totalPages: 1, goToPage: vi.fn(), isLoading: false, isError: false };
    h.rounds = { items: [], isLoading: false, isError: false };
    h.roundFilters = [];
  });

  it("opening a card opens the sheet on that protocol", () => {
    h.page.items = [plan("Mastitis 5-day")];
    renderTab();
    expect(screen.queryByTestId("sheet")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "open-Mastitis 5-day" }));
    expect(screen.getByTestId("sheet").textContent).toBe("Mastitis 5-day");
  });

  it("shows no 'not part of a protocol' entry when every step belongs to one", () => {
    h.page.items = [plan("A")];
    renderTab();
    expect(screen.queryByText("Not part of a protocol")).toBeNull();
  });

  it("steps with no protocol get their own entry, with a count, in the Running view, and it opens the sheet", () => {
    h.page.items = [plan("A")];
    h.loose.items = [{ id: "t1" }, { id: "t2" }];
    renderTab();
    // nothing is running, so the page opens on Library, where the entry is not shown
    expect(screen.queryByText("Not part of a protocol")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: /^Running/ }));
    expect(screen.getByText("Not part of a protocol")).toBeTruthy();
    expect(screen.getByText("2 steps")).toBeTruthy();
    fireEvent.click(screen.getByText("Not part of a protocol"));
    expect(screen.getByTestId("sheet").textContent).toBe("loose");
  });

});

const round = (key: string, over: Record<string, unknown> = {}) => ({ roundKey: key, stepsOverdue: 0, stepsDueToday: 0, nextDueDate: null, healthPlan: { id: "p1", name: "FMD vaccine" }, ...over });
const tabNamed = (name: RegExp) => screen.getByRole("tab", { name });

describe("HealthPlanTab - Running | Library (RFE-146, EPIC_PROTOCOL_ROUNDS D1)", () => {
  beforeEach(() => {
    h.filtersSeen = [];
    h.loose = { items: [], hasNextPage: false };
    h.page = { items: [], totalPages: 1, goToPage: vi.fn(), isLoading: false, isError: false };
    h.rounds = { items: [], isLoading: false, isError: false };
    h.roundFilters = [];
  });

  it("opens on Running when a running round has a step due or late", () => {
    h.rounds.items = [round("app:a", { stepsDueToday: 1 })];
    renderTab();
    expect(tabNamed(/^Running/).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("rounds-view")).toBeTruthy();
    expect(screen.queryByTestId("card")).toBeNull();
  });

  it("opens on Library when nothing is running", () => {
    renderTab();
    expect(tabNamed(/^Library/).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByTestId("rounds-view")).toBeNull();
  });

  it("opens on Library when running rounds exist but none is due", () => {
    h.rounds.items = [round("app:a", { nextDueDate: "2026-10-09" })];
    renderTab();
    expect(tabNamed(/^Library/).getAttribute("aria-selected")).toBe("true");
  });

  it("falls back to Library when the rounds cannot be loaded", () => {
    h.rounds.isError = true;
    renderTab();
    expect(tabNamed(/^Library/).getAttribute("aria-selected")).toBe("true");
  });

  it("the Running tab carries the count of running rounds", () => {
    h.rounds.items = [round("app:a"), round("app:b")];
    renderTab();
    expect(tabNamed(/^Running/).textContent).toBe("Running (2)");
  });

  it("the user's own choice wins over the default", () => {
    h.rounds.items = [round("app:a", { stepsOverdue: 2 })];
    renderTab();
    expect(tabNamed(/^Running/).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(tabNamed(/^Library/));
    expect(tabNamed(/^Library/).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByTestId("rounds-view")).toBeNull();
  });

  it("shows a loading state until it knows which view to open", () => {
    h.rounds.isLoading = true;
    renderTab();
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("Running view gets the kind and search, and the Finished switch narrows it", async () => {
    h.rounds.items = [round("app:a", { stepsDueToday: 1 })];
    renderTab();
    expect(screen.getByTestId("rounds-view").textContent).toContain("finished=false");
    fireEvent.click(screen.getByRole("radio", { name: "Prevention" }));
    fireEvent.change(screen.getByPlaceholderText("Find health plan by name"), { target: { value: " fmd " } });
    await waitFor(() => expect(screen.getByTestId("rounds-view").textContent).toContain("kind=PREVENTION;search=fmd"));
    fireEvent.click(screen.getByRole("switch", { name: "Finished rounds" }));
    expect(screen.getByTestId("rounds-view").textContent).toContain("finished=true");
  });

  it("the Finished switch and the condition filter belong to their own view", () => {
    h.rounds.items = [round("app:a", { stepsDueToday: 1 })];
    renderTab();
    expect(screen.getByRole("switch", { name: "Finished rounds" })).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull(); // the condition select is a Library filter
    fireEvent.click(tabNamed(/^Library/));
    expect(screen.queryByRole("switch", { name: "Finished rounds" })).toBeNull();
    expect(screen.getByRole("combobox")).toBeTruthy();
  });

  it("opening a round opens the sheet on that round", () => {
    h.rounds.items = [round("app:a", { stepsDueToday: 1 })];
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "open-round" }));
    expect(screen.getByTestId("sheet").textContent).toBe("round:app:r1");
  });

  it("a ?round= link (RFE-150) opens that round's sheet once the running list is in, then hands the param back", () => {
    h.rounds.items = [round("trt:p9:2026-10-01", { stepsOverdue: 2 })];
    const onRoundOpened = vi.fn();
    renderTab({ openRoundKey: "trt:p9:2026-10-01", onRoundOpened });
    expect(screen.getByTestId("sheet").textContent).toBe("round:trt:p9:2026-10-01");
    expect(onRoundOpened).toHaveBeenCalled();
  });

  it("a ?round= link to a round that is no longer running opens nothing but still clears the param", () => {
    h.rounds.items = [round("app:a", { stepsDueToday: 1 })];
    const onRoundOpened = vi.fn();
    renderTab({ openRoundKey: "app:gone", onRoundOpened });
    expect(screen.queryByTestId("sheet")).toBeNull();
    expect(onRoundOpened).toHaveBeenCalled();
  });

  it("a ?round= link waits for the running list instead of giving up on it", () => {
    h.rounds = { items: [], isLoading: true, isError: false };
    const onRoundOpened = vi.fn();
    renderTab({ openRoundKey: "app:a", onRoundOpened });
    expect(onRoundOpened).not.toHaveBeenCalled();
  });

  it("without a ?round= link nothing opens by itself", () => {
    h.rounds.items = [round("app:a", { stepsOverdue: 1 })];
    const onRoundOpened = vi.fn();
    renderTab({ onRoundOpened });
    expect(screen.queryByTestId("sheet")).toBeNull();
    expect(onRoundOpened).not.toHaveBeenCalled();
  });

  it("the round view's empty state can send you to the Library", () => {
    h.rounds.items = [round("app:a", { stepsDueToday: 1 })];
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "go-library" }));
    expect(tabNamed(/^Library/).getAttribute("aria-selected")).toBe("true");
  });

  it("a Library card says how many rounds of that protocol are running", () => {
    h.rounds.items = [round("app:a"), round("app:b"), round("app:c", { healthPlan: { id: "other", name: "Other" } })];
    h.page.items = [{ id: "p1", name: "FMD vaccine", stats: stats() }];
    renderTab();
    fireEvent.click(tabNamed(/^Library/));
    expect(screen.getByTestId("running-count").textContent).toBe("2");
  });
});

describe("byUrgency", () => {
  it("puts a protocol with nothing scheduled after one with a next step, then by name", () => {
    const list = [plan("Zed"), plan("Amy"), plan("Next", { nextDueDate: "2026-11-01" })];
    expect([...list].sort(byUrgency).map((p) => p.name)).toEqual(["Next", "Amy", "Zed"]);
  });
});
