import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import type { NotificationSchedule, UpcomingItem } from "../types";
import { groupByDay, UpcomingTab } from "./upcoming-tab";

const perms = vi.hoisted(() => ({ allowed: new Set<string>(["notification.create"]) }));
vi.mock("@/lib/auth/permissions", () => ({ useCan: () => (p: string) => perms.allowed.has(p) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const upcoming = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
const schedules = vi.hoisted(() => ({ state: { items: [] as unknown[] } }));
const mutations = vi.hoisted(() => ({
  pause: vi.fn().mockResolvedValue({}),
  resume: vi.fn().mockResolvedValue({}),
  cancel: vi.fn().mockResolvedValue({}),
}));

vi.mock("../hooks/use-upcoming", () => ({ useUpcoming: () => upcoming.state }));
vi.mock("../hooks/use-schedules", () => ({
  useSchedules: () => schedules.state,
  usePauseSchedule: () => ({ mutateAsync: mutations.pause, isPending: false }),
  useResumeSchedule: () => ({ mutateAsync: mutations.resume, isPending: false }),
  useCancelSchedule: () => ({ mutateAsync: mutations.cancel, isPending: false }),
}));

function item(over: Partial<UpcomingItem>): UpcomingItem {
  return {
    occurrence_id: "o1",
    schedule_id: "s1",
    fire_at: "2026-11-10T02:00:00.000Z",
    fire_at_local: "2026-11-10T08:00",
    title: "Check the fence",
    body: null,
    origin: "USER",
    category: "operational",
    priority: "medium",
    link: null,
    animals_count: 0,
    repeat: "NEVER",
    can_edit: true,
    ...over,
  };
}

function listState(items: UpcomingItem[], over: Record<string, unknown> = {}) {
  return {
    items,
    isLoading: false,
    isError: false,
    isNextPageError: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    refetch: vi.fn(),
    fetchNextPage: vi.fn(),
    ...over,
  };
}

function renderTab(onEdit?: (id: string) => void) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <UpcomingTab onEdit={onEdit} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  perms.allowed = new Set(["notification.create"]);
  schedules.state = { items: [] };
  upcoming.state = listState([]);
});

describe("groupByDay", () => {
  it("groups consecutive rows by the farm-local day", () => {
    const groups = groupByDay([
      item({ occurrence_id: "a", fire_at_local: "2026-11-10T08:00" }),
      item({ occurrence_id: "b", fire_at_local: "2026-11-10T18:00" }),
      item({ occurrence_id: "c", fire_at_local: "2026-11-11T08:00" }),
    ]);
    expect(groups.map((g) => [g.day, g.items.length])).toEqual([
      ["2026-11-10", 2],
      ["2026-11-11", 1],
    ]);
  });
});

describe("UpcomingTab", () => {
  it("shows skeletons while loading", () => {
    upcoming.state = listState([], { isLoading: true });
    const { container } = renderTab();
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
  });

  it("shows an error state and retries", () => {
    const state = listState([], { isError: true });
    upcoming.state = state;
    renderTab();
    expect(screen.getByText("Could not load upcoming notifications.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again|retry/i }));
    expect(state.refetch).toHaveBeenCalled();
  });

  it("shows the empty state", () => {
    renderTab();
    expect(screen.getByText("Nothing coming up")).toBeInTheDocument();
  });

  it("renders source badges; actions only on own manual rows", () => {
    upcoming.state = listState([
      item({ occurrence_id: "a", schedule_id: "s-mine", title: "Mine" }),
      item({ occurrence_id: "b", schedule_id: "s-sys", title: "Auto", origin: "SYSTEM", can_edit: false }),
      item({ occurrence_id: "c", schedule_id: "s-other", title: "Theirs", can_edit: false }),
    ]);
    renderTab();
    expect(screen.getByText("Yours")).toBeInTheDocument();
    expect(screen.getByText("Automatic")).toBeInTheDocument();
    expect(screen.getByText("Shared with you")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause Mine" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pause Auto" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Pause Theirs" })).toBeNull();
  });

  it("hides actions without create/manage permission", () => {
    perms.allowed = new Set();
    upcoming.state = listState([item({ title: "Mine" })]);
    renderTab();
    expect(screen.queryByRole("button", { name: "Pause Mine" })).toBeNull();
  });

  it("pauses and calls onEdit with the schedule id", async () => {
    upcoming.state = listState([item({ schedule_id: "s9", title: "Mine" })]);
    const onEdit = vi.fn();
    renderTab(onEdit);
    fireEvent.click(screen.getByRole("button", { name: "Edit Mine" }));
    expect(onEdit).toHaveBeenCalledWith("s9");
    fireEvent.click(screen.getByRole("button", { name: "Pause Mine" }));
    await waitFor(() => expect(mutations.pause).toHaveBeenCalledWith("s9"));
  });

  it("asks for confirmation before cancelling", async () => {
    upcoming.state = listState([item({ schedule_id: "s9", title: "Mine" })]);
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Cancel Mine" }));
    expect(mutations.cancel).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Cancel reminder" }));
    await waitFor(() => expect(mutations.cancel).toHaveBeenCalledWith("s9"));
  });

  it("loads more when a next page exists", () => {
    const state = listState([item({})], { hasNextPage: true });
    upcoming.state = state;
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(state.fetchNextPage).toHaveBeenCalled();
  });

  it("lists paused schedules with a resume action", async () => {
    schedules.state = { items: [{ id: "p1", title: "Old one", can_edit: true } as NotificationSchedule] };
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Resume Old one" }));
    await waitFor(() => expect(mutations.resume).toHaveBeenCalledWith("p1"));
  });
});
