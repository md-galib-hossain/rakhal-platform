import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
  reminderHighlights: { upcoming: number; overdue: number; repeating: number };
};
// Stable references (as the real hook returns from query data).
const HIGHLIGHTS = { dueToday: 3, overdue: 2, blocked: 1, lateCompletionRatePct: 12 };
const REMINDER_HIGHLIGHTS = { upcoming: 4, overdue: 5, repeating: 1 };
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
vi.mock("@/features/events/components/reminders/reminder-sheet", () => ({ ReminderSheet: ({ open }: { open: boolean }) => (open ? <div>reminder-sheet</div> : null) }));
vi.mock("./task-details-sheet", () => ({ TaskDetailsSheet: () => null }));
vi.mock("./task-date-filter", () => ({ TaskDateFilterPicker: () => <div>date-filter</div>, taskPresetRange: () => null }));

import { TasksView } from "./tasks-view";
import { ReminderTabs } from "./reminder-tabs";
import { ReminderCard } from "./reminder-card";

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
    recurrenceIntervalDays: null,
    cattleTags: [],
    relatedCattle: null,
    assignedTo: null,
    recipientUserIds: [],
    notifyRoleNames: [],
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
  state = { items: [task()], isLoading: false, isError: false, isNextPageError: false, highlights: HIGHLIGHTS, reminderHighlights: REMINDER_HIGHLIGHTS };
});

describe("TasksView", () => {
  it("switching segment keeps other URL params", () => {
    search = "view=cow-9";
    renderView();
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Reminders/ }), { button: 0 });
    expect(replace).toHaveBeenCalledWith("/tasks?view=cow-9&segment=reminders", { scroll: false });
  });

  it("returning to Tasks removes only the segment param", () => {
    search = "view=cow-9&segment=reminders";
    renderView();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Tasks" }), { button: 0 });
    expect(replace).toHaveBeenCalledWith("/tasks?view=cow-9", { scroll: false });
  });

  it("segment follows the URL after the navigation lands", () => {
    const { rerender } = renderView();
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Reminders/ }), { button: 0 });
    search = "segment=reminders"; // what the router would now report
    rerender(ui(<TasksView />));
    expect(screen.getByRole("tab", { name: /Reminders/ })).toHaveAttribute("data-state", "active");
  });

  it("Upcoming asks the server for filter=upcoming with no clock in the query", () => {
    search = "segment=reminders";
    renderView();
    const f = seenFilters.at(-1)!;
    expect(f).toMatchObject({ kind: "reminder", filter: "upcoming", sortOrder: "asc" });
    expect(f.dueFrom).toBeUndefined();
    expect(JSON.stringify(seenFilters[0])).toBe(JSON.stringify(seenFilters.at(-1)));
  });

  it("Done sorts newest first", () => {
    search = "segment=reminders";
    renderView();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Done" }), { button: 0 });
    expect(seenFilters.at(-1)).toMatchObject({ kind: "reminder", status: "COMPLETED,CANCELLED", sortOrder: "desc" });
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
    expect(screen.getByRole("tab", { name: /Reminders/ })).toHaveTextContent("9");
  });

  it("inner tablists are labelled and controlled panels exist", () => {
    renderView();
    expect(screen.getByRole("tablist", { name: "Task views" })).toBeInTheDocument();
    const tab = screen.getByRole("tab", { name: /All Tasks/ });
    const panelId = tab.getAttribute("aria-controls")!;
    expect(document.getElementById(panelId)).toHaveAttribute("role", "tabpanel");
    const outer = screen.getByRole("tab", { name: "Tasks" }).getAttribute("aria-controls")!;
    expect(document.getElementById(outer)).toHaveAttribute("role", "tabpanel");
  });
});

describe("ReminderTabs", () => {
  const renderTabs = (counts?: Partial<Record<"upcoming" | "overdue" | "repeating" | "done", number>>) =>
    render(ui(<ReminderTabs value="upcoming" onChange={vi.fn()} counts={counts} panelId="p" />));

  it("shows counts with a destructive Overdue badge", () => {
    renderTabs({ upcoming: 4, overdue: 5 });
    expect(screen.getByRole("tab", { name: /Upcoming/ })).toHaveTextContent("4");
    expect(screen.getByText("5").className).toContain("text-destructive");
  });
  it("omits badges when counts are unknown", () => {
    renderTabs(undefined);
    expect(screen.getByRole("tab", { name: "Upcoming" })).toHaveTextContent(/^Upcoming$/);
  });
  it("omits zero badges", () => {
    renderTabs({ upcoming: 0 });
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
  it("labels the tablist and points every tab at the panel", () => {
    renderTabs();
    expect(screen.getByRole("tablist", { name: "Reminder views" })).toBeInTheDocument();
    for (const tab of screen.getAllByRole("tab")) expect(tab).toHaveAttribute("aria-controls", "p");
  });
});

describe("ReminderCard", () => {
  const reminder = (over: Partial<Task> = {}) => task({ kind: "REMINDER", name: "Vaccinate", displayStatus: "pending", ...over });

  it("offers Done on an open reminder to a user who can complete", () => {
    render(ui(<ReminderCard task={reminder()} onOpen={vi.fn()} />));
    fireEvent.click(screen.getByRole("button", { name: /Done/ }));
    expect(completeMutate).toHaveBeenCalledWith({ id: "t1", dto: {} });
  });
  it("gates Done on task.complete", () => {
    allowed.delete("task.complete");
    render(ui(<ReminderCard task={reminder()} onOpen={vi.fn()} />));
    expect(screen.queryByRole("button", { name: /Done/ })).not.toBeInTheDocument();
  });
  it("hides Done on a finished reminder", () => {
    render(ui(<ReminderCard task={reminder({ displayStatus: "completed", status: "COMPLETED" })} onOpen={vi.fn()} />));
    expect(screen.queryByRole("button", { name: /Done/ })).not.toBeInTheDocument();
  });
  it("describes the repeat", () => {
    render(ui(<ReminderCard task={reminder({ recurring: true, recurrenceType: "WEEKLY" })} onOpen={vi.fn()} />));
    expect(screen.getByText(/week/i)).toBeInTheDocument();
  });
});
