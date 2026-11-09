import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import type { Task, TaskListFilters } from "../types";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const replace = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/tasks",
  useSearchParams: () => new URLSearchParams(search),
}));

const allowed = new Set<string>(["task.create", "task.complete"]);
vi.mock("@/lib/auth/permissions", () => ({
  Can: ({ I, children }: { I: string; children: React.ReactNode }) => (allowed.has(I) ? <>{children}</> : null),
  useCan: () => (p: string) => allowed.has(p),
}));

const completeMutate = vi.fn().mockResolvedValue({});
type ListState = {
  items: Task[];
  isLoading: boolean;
  isError: boolean;
  isNextPageError: boolean;
  highlights: { dueToday: number; overdue: number; blocked: number; lateCompletionRatePct: number };
};
// Stable references (as the real hook returns from query data).
const HIGHLIGHTS = { dueToday: 3, overdue: 2, blocked: 1, lateCompletionRatePct: 12 };
let state: ListState;
const seenFilters: TaskListFilters[] = [];
vi.mock("../hooks/use-tasks", () => ({
  useTaskInfiniteList: (filters: TaskListFilters) => {
    seenFilters.push(filters);
    return { ...state, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: vi.fn(), refetch: vi.fn() };
  },
  useCompleteTask: () => ({ mutateAsync: completeMutate, isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("./create-task-sheet", () => ({ CreateTaskSheet: ({ open }: { open: boolean }) => (open ? <div>create-task-sheet</div> : null) }));
vi.mock("./task-details-sheet", () => ({ TaskDetailsSheet: () => null }));
vi.mock("./task-date-filter", () => ({ TaskDateFilterPicker: () => <div>date-filter</div>, taskPresetRange: () => null }));

import { TasksView } from "./tasks-view";

const task = (over: Partial<Task> = {}): Task =>
  ({
    id: "t1",
    reference: "TSK-1",
    name: "Check hoof",
    details: null,
    kind: "TASK",
    category: "GENERAL",
    priority: "LOW",
    status: "PENDING",
    displayStatus: "pending",
    dueAt: "2026-11-10T06:00:00.000Z",
    overdueByHours: null,
    recurring: false,
    recurrenceType: null,
    cattleTags: [],
    relatedCattle: null,
    assignedTo: null,
    ...over,
  }) as unknown as Task;

function ui(node: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
      {node}
    </NextIntlClientProvider>
  );
}
const renderView = () => render(ui(<TasksView />));

beforeEach(() => {
  vi.clearAllMocks();
  search = "";
  seenFilters.length = 0;
  allowed.clear();
  allowed.add("task.create");
  allowed.add("task.complete");
  state = { items: [task()], isLoading: false, isError: false, isNextPageError: false, highlights: HIGHLIGHTS };
});

describe("TasksView", () => {
  it("has no Reminders segment (reminders moved to the notification sheet)", () => {
    renderView();
    expect(screen.queryByRole("tab", { name: /Reminders/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New reminder/ })).not.toBeInTheDocument();
  });

  it("lists tasks with no kind filter and no clock in the query", () => {
    renderView();
    const f = seenFilters.at(-1)!;
    expect(f).toMatchObject({ filter: "all" });
    expect(f).not.toHaveProperty("kind");
    expect(f.dueFrom).toBeUndefined();
    expect(JSON.stringify(seenFilters[0])).toBe(JSON.stringify(seenFilters.at(-1)));
  });

  it("an old ?segment=reminders bookmark just shows the task list", () => {
    search = "segment=reminders";
    renderView();
    expect(screen.getByText("Check hoof")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("drops a legacy REMINDER row an older backend may still return", () => {
    state = { ...state, items: [task(), task({ id: "r1", name: "Old reminder row", kind: "REMINDER" })] };
    renderView();
    expect(screen.getByText("Check hoof")).toBeInTheDocument();
    expect(screen.queryByText("Old reminder row")).not.toBeInTheDocument();
  });

  it("loading phase shows a polite status, not cards or empty state", () => {
    state = { ...state, items: [], isLoading: true };
    renderView();
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(within(status).getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText("No tasks yet")).not.toBeInTheDocument();
  });

  it("error phase shows the error state, never the skeleton", () => {
    state = { ...state, items: [], isError: true };
    renderView();
    expect(screen.getByText("Could not load tasks.")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("empty phase shows the empty state", () => {
    state = { ...state, items: [] };
    renderView();
    expect(screen.getByText("No tasks yet")).toBeInTheDocument();
  });

  it("list phase renders the cards", () => {
    renderView();
    expect(screen.getByText("Check hoof")).toBeInTheDocument();
  });

  it("hides Create Task from a user without task.create", () => {
    allowed.delete("task.create");
    renderView();
    expect(screen.queryByRole("button", { name: /Create Task/ })).not.toBeInTheDocument();
  });

  it("shows Create Task to a user with task.create", () => {
    renderView();
    expect(screen.getByRole("button", { name: /Create Task/ })).toBeInTheDocument();
  });

  it("loading never shows fake zero chips or badges", () => {
    state = { ...state, items: [], isLoading: true };
    renderView();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
    expect(screen.getAllByText("–").length).toBeGreaterThan(0);
    expect(screen.getByRole("tab", { name: "Overdue" })).toHaveTextContent(/^Overdue$/);
  });

  it("loaded values render as chips and badges", () => {
    renderView();
    expect(screen.getByText("12%")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Overdue/ })).toHaveTextContent("2");
  });

  it("the tablist is labelled and its controlled panel exists", () => {
    renderView();
    expect(screen.getByRole("tablist", { name: "Task views" })).toBeInTheDocument();
    const tab = screen.getByRole("tab", { name: /All Tasks/ });
    const panelId = tab.getAttribute("aria-controls")!;
    expect(document.getElementById(panelId)).toHaveAttribute("role", "tabpanel");
  });
});
