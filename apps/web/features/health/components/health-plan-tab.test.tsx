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
vi.mock("./applied-view", () => ({
  AppliedView: ({ kind, search, status, onStatusChange, onOpen, onShowLibrary }: { kind: string; search: string; status: string; onStatusChange: (s: string) => void; onOpen: (round: unknown) => void; onShowLibrary: () => void }) => (
    <div data-testid="applied-view">
      kind={kind};search={search};status={status}
      <button type="button" onClick={() => onOpen({ roundKey: "app:r1", healthPlan: { name: "FMD vaccine" } })}>
        open-round
      </button>
      <button type="button" onClick={onShowLibrary}>
        go-library
      </button>
      <button type="button" onClick={() => onStatusChange("all")}>
        status-all
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

function renderTab(props: { openRoundKey?: string | null; onRoundOpened?: () => void; status?: "needs" | "upcoming" | "finished" | "all" | null; onStatusChange?: (status: string) => void } = {}) {
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

  it("the kind chips filter on the server, with no page-sized counts", async () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(await screen.findByText("Protocol kind"));
    fireEvent.click(await screen.findByText("Prevention"));
    expect(lastFilters()).toMatchObject({ kind: "PREVENTION" });
    expect(screen.getByText("Protocol kind:")).toBeTruthy();
    expect(screen.getAllByText("Prevention").length).toBeGreaterThanOrEqual(1);

    const removeBtn = screen.getByLabelText("Remove Prevention");
    fireEvent.click(removeBtn);
    expect(lastFilters().kind).toBeUndefined();
    expect(screen.queryByText("Protocol kind:")).toBeNull();
  });

  it("search goes to the server", async () => {
    renderTab();
    fireEvent.change(screen.getByPlaceholderText("Find health plan by name"), { target: { value: "  mast " } });
    await waitFor(() => expect(lastFilters()).toMatchObject({ search: "mast" }));
  });

  it("keeps the server's order - the Library is templates, so there is no urgency sorting", () => {
    h.page.items = [plan("Quiet", { nextDueDate: "2026-10-09" }), plan("Late", { stepsOverdue: 1 }), plan("Today", { stepsDue: 2 })];
    renderTab();
    expect(screen.getAllByTestId("card").map((c) => c.firstChild?.textContent)).toEqual(["Quiet", "Late", "Today"]);
  });

  it("a filter with no match offers to clear it", async () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(await screen.findByText("Protocol kind"));
    fireEvent.click(await screen.findByText("Treatment"));
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

  it("shows no 'not part of a protocol' entry when every step belongs to one", () => {
    h.page.items = [plan("A")];
    renderTab();
    expect(screen.queryByText("Not part of a protocol")).toBeNull();
  });

  it("steps with no protocol get their own entry, with a count, in the Running view, and it opens the sheet", async () => {
    h.page.items = [plan("A")];
    h.loose.items = [{ id: "t1" }, { id: "t2" }];
    renderTab();
    // nothing is running, so the page opens on Library, where the entry is not shown
    expect(screen.queryByText("Not part of a protocol")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(await screen.findByText("Protocols view"));
    fireEvent.click(await screen.findByText("Applied"));
    expect(screen.getByText("Not part of a protocol")).toBeTruthy();
    expect(screen.getByText("2 steps")).toBeTruthy();
    fireEvent.click(screen.getByText("Not part of a protocol"));
    expect(screen.getByTestId("sheet").textContent).toBe("loose");
  });

});

const round = (key: string, over: Record<string, unknown> = {}) => ({ roundKey: key, stepsOverdue: 0, stepsDueToday: 0, nextDueDate: null, healthPlan: { id: "p1", name: "FMD vaccine" }, ...over });

async function switchViewTo(target: "Applied" | "Library") {
  fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
  fireEvent.click(await screen.findByText("Protocols view"));
  fireEvent.click(await screen.findByText(target));
  fireEvent.click(screen.getByLabelText("Close filters"));
}

describe("HealthPlanTab - Library | Applied (RFE-146, EPIC_PROTOCOL_ROUNDS D1)", () => {
  beforeEach(() => {
    h.filtersSeen = [];
    h.loose = { items: [], hasNextPage: false };
    h.page = { items: [], totalPages: 1, goToPage: vi.fn(), isLoading: false, isError: false };
    h.rounds = { items: [], isLoading: false, isError: false };
    h.roundFilters = [];
  });

  it("opens on Applied when a running round has a step due or late", () => {
    h.rounds.items = [round("app:a", { stepsDueToday: 1 })];
    renderTab();
    expect(screen.getByTestId("applied-view")).toBeTruthy();
    expect(screen.queryByTestId("card")).toBeNull();
  });

  it("opens on Library when nothing is running", () => {
    renderTab();
    expect(screen.queryByTestId("applied-view")).toBeNull();
  });

  it("opens on Library when running rounds exist but none is due", () => {
    h.rounds.items = [round("app:a", { nextDueDate: "2026-10-09" })];
    renderTab();
    expect(screen.queryByTestId("applied-view")).toBeNull();
  });

  it("falls back to Library when the rounds cannot be loaded", () => {
    h.rounds.isError = true;
    renderTab();
    expect(screen.queryByTestId("applied-view")).toBeNull();
  });

  it("the Applied view category option carries the count of applied protocols", async () => {
    h.rounds.items = [round("app:a"), round("app:b")];
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    fireEvent.click(await screen.findByText("Protocols view"));
    expect(await screen.findByText("2")).toBeTruthy();
  });

  it("the user's own choice wins over the default", async () => {
    h.rounds.items = [round("app:a", { stepsOverdue: 2 })];
    renderTab();
    expect(screen.getByTestId("applied-view")).toBeTruthy();
    await switchViewTo("Library");
    expect(screen.queryByTestId("applied-view")).toBeNull();
  });

  it("shows a loading state until it knows which view to open", () => {
    h.rounds.isLoading = true;
    renderTab();
    expect(screen.queryByPlaceholderText("Find health plan by name")).toBeNull();
  });

  it("the Applied view gets the kind, the search and a status that starts on Needs action", async () => {
    h.rounds.items = [round("app:a", { stepsDueToday: 1 })];
    renderTab();
    expect(screen.getByTestId("applied-view").textContent).toContain("status=needs");
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    fireEvent.click(await screen.findByText("Protocol kind"));
    fireEvent.click(await screen.findByText("Prevention"));
    fireEvent.change(screen.getByPlaceholderText("Find health plan by name"), { target: { value: " fmd " } });
    await waitFor(() => expect(screen.getByTestId("applied-view").textContent).toContain("kind=PREVENTION;search=fmd"));
  });

  it("there are no Late only / Finished rounds switches any more; the condition filter belongs to Library", async () => {
    h.rounds.items = [round("app:a", { stepsDueToday: 1 })];
    renderTab();
    expect(screen.queryByRole("switch")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    expect(screen.queryByText("Condition")).toBeNull();
    fireEvent.click(screen.getByLabelText("Close filters"));
    await switchViewTo("Library");
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    expect(await screen.findByText("Condition")).toBeTruthy();
  });

  it("the filter categories list includes Protocols view with Library and Applied", async () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    fireEvent.click(await screen.findByText("Protocols view"));
    expect(await screen.findByText("Library")).toBeTruthy();
    expect(await screen.findByText("Applied")).toBeTruthy();
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

  it("a status change is handed to the caller (the URL) and shown", () => {
    h.rounds.items = [round("app:a", { stepsOverdue: 1 })];
    const onStatusChange = vi.fn();
    renderTab({ onStatusChange });
    fireEvent.click(screen.getByRole("button", { name: "status-all" }));
    expect(onStatusChange).toHaveBeenCalledWith("all");
    expect(screen.getByTestId("applied-view").textContent).toContain("status=all");
  });

  it("a ?status= link (the Late steps tile) lands on Applied even when nothing is due", () => {
    h.rounds.items = [round("app:a")];
    renderTab({ status: "needs" });
    expect(screen.getByTestId("applied-view")).toBeTruthy();
    expect(screen.getByTestId("applied-view").textContent).toContain("status=needs");
  });

  it("the caller's status wins over the tab's own", () => {
    h.rounds.items = [round("app:a")];
    renderTab({ status: "finished" });
    expect(screen.getByTestId("applied-view").textContent).toContain("status=finished");
  });

  it("the round view's empty state can send you to the Library", () => {
    h.rounds.items = [round("app:a", { stepsDueToday: 1 })];
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "go-library" }));
    expect(screen.queryByTestId("applied-view")).toBeNull();
  });

});

describe("byUrgency", () => {
  it("puts a protocol with nothing scheduled after one with a next step, then by name", () => {
    const list = [plan("Zed"), plan("Amy"), plan("Next", { nextDueDate: "2026-11-01" })];
    expect([...list].sort(byUrgency).map((p) => p.name)).toEqual(["Next", "Amy", "Zed"]);
  });
});
