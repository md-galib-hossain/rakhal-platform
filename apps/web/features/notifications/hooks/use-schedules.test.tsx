import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const api = vi.hoisted(() => ({
  upcoming: vi.fn(),
  listSchedules: vi.fn(),
  getSchedule: vi.fn(),
  createSchedule: vi.fn(),
  updateSchedule: vi.fn(),
  pauseSchedule: vi.fn(),
  resumeSchedule: vi.fn(),
  cancelSchedule: vi.fn(),
  previewSchedule: vi.fn(),
}));
vi.mock("../api", () => ({ notificationsApi: api }));

import { qk } from "@/lib/query/keys";
import type { CreateScheduleInput, NotificationSchedule } from "../types";
import { useCancelSchedule, useCreateSchedule, usePauseSchedule, usePreviewSchedule, useSchedules } from "./use-schedules";
import { useUpcoming } from "./use-upcoming";

const schedule = { id: "s1", title: "t", status: "ACTIVE" } as NotificationSchedule;
const input: CreateScheduleInput = {
  title: " t ",
  trigger: "DATE",
  date: "2026-11-10",
  audience: { mode: "USER", user_id: "u" },
};

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

const page = (ids: string[], hasNextPage: boolean, endCursor: string | null) => ({
  items: ids.map((id) => ({ occurrence_id: id })),
  meta: { count: ids.length, limit: 2, hasNextPage, hasPreviousPage: false, startCursor: null, endCursor },
});

beforeEach(() => vi.clearAllMocks());

describe("useUpcoming", () => {
  it("pages by cursor, dedupes by occurrence_id and defaults sortOrder asc", async () => {
    api.upcoming
      .mockResolvedValueOnce(page(["o1", "o2"], true, "c1"))
      .mockResolvedValueOnce(page(["o2", "o3"], false, null));
    const { wrapper } = setup();
    const { result } = renderHook(() => useUpcoming({ from: "2026-11-05" }, { pageSize: 2 }), { wrapper });
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(api.upcoming).toHaveBeenCalledWith({ from: "2026-11-05", sortOrder: "asc" }, undefined, 2);
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.items.map((r) => r.occurrence_id)).toEqual(["o1", "o2", "o3"]));
    expect(api.upcoming.mock.calls[1][1]).toBe("c1");
    expect(result.current.hasNextPage).toBe(false);
  });
});

describe("useSchedules", () => {
  it("defaults scope to mine", async () => {
    api.listSchedules.mockResolvedValue({ items: [schedule], meta: page([], false, null).meta });
    const { wrapper } = setup();
    const { result } = renderHook(() => useSchedules({ status: "ACTIVE" }), { wrapper });
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(api.listSchedules).toHaveBeenCalledWith({ status: "ACTIVE", scope: "mine" }, undefined, 20);
  });
});

describe("schedule mutations", () => {
  it("create normalises the body, caches the detail and invalidates schedules + upcoming", async () => {
    api.createSchedule.mockResolvedValue(schedule);
    const { client, wrapper } = setup();
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useCreateSchedule(), { wrapper });
    await act(() => result.current.mutateAsync(input));
    expect(api.createSchedule).toHaveBeenCalledWith(expect.objectContaining({ title: "t" }));
    expect(client.getQueryData(qk.notifications.schedule("s1"))).toEqual(schedule);
    const keys = spy.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey);
    expect(keys).toEqual(expect.arrayContaining([qk.notifications.schedulesAll(), qk.notifications.upcomingAll()]));
  });

  it("pause stores the returned schedule; cancel removes the detail cache", async () => {
    api.pauseSchedule.mockResolvedValue({ ...schedule, status: "PAUSED" });
    api.cancelSchedule.mockResolvedValue({ id: "s1", status: "CANCELLED" });
    const { client, wrapper } = setup();
    const pause = renderHook(() => usePauseSchedule(), { wrapper });
    await act(() => pause.result.current.mutateAsync("s1"));
    expect(client.getQueryData<NotificationSchedule>(qk.notifications.schedule("s1"))?.status).toBe("PAUSED");
    const cancel = renderHook(() => useCancelSchedule(), { wrapper });
    await act(() => cancel.result.current.mutateAsync("s1"));
    expect(client.getQueryData(qk.notifications.schedule("s1"))).toBeUndefined();
  });

  it("preview posts the normalised draft and exposes the result without invalidating", async () => {
    const preview = { timezone: "Asia/Dhaka", all_day: true, next_fire_times: [], recipient_count: 1 };
    api.previewSchedule.mockResolvedValue(preview);
    const { client, wrapper } = setup();
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => usePreviewSchedule(), { wrapper });
    await act(() => result.current.mutateAsync(input));
    expect(api.previewSchedule).toHaveBeenCalledWith(expect.objectContaining({ title: "t" }));
    await waitFor(() => expect(result.current.data).toEqual(preview));
    expect(spy).not.toHaveBeenCalled();
  });
});
