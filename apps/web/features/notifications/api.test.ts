import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();
const apiFetchPage = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiFetch: (...a: unknown[]) => apiFetch(...a) as Promise<unknown>,
  apiFetchPage: (...a: unknown[]) => apiFetchPage(...a) as Promise<unknown>,
}));

import { qk } from "@/lib/query/keys";
import { notificationsApi } from "./api";

beforeEach(() => vi.clearAllMocks());

describe("notificationsApi v2", () => {
  it("upcoming sends the farm-local window, sort and cursor via the page fetcher", async () => {
    apiFetchPage.mockResolvedValue({ items: [], meta: {} });
    await notificationsApi.upcoming({ from: "2026-11-05", to: "2026-11-19", sortOrder: "asc" }, "cur1", 30);
    expect(apiFetchPage).toHaveBeenCalledWith("/notifications/upcoming", {
      searchParams: { from: "2026-11-05", to: "2026-11-19", sortOrder: "asc", cursor: "cur1", limit: 30 },
    });
  });

  it("listSchedules sends scope/status", async () => {
    await notificationsApi.listSchedules({ scope: "farm", status: "PAUSED" }, undefined, 20);
    expect(apiFetchPage).toHaveBeenCalledWith("/notifications/schedules", {
      searchParams: { scope: "farm", status: "PAUSED", cursor: undefined, limit: 20 },
    });
  });

  it("maps CRUD, pause/resume and preview to the right verbs and paths", async () => {
    const input = { title: "t", trigger: "DATE" as const, audience: { mode: "USER" as const, user_id: "u" } };
    await notificationsApi.createSchedule(input);
    await notificationsApi.previewSchedule(input);
    await notificationsApi.getSchedule("s1");
    await notificationsApi.updateSchedule("s1", { title: "x" });
    await notificationsApi.pauseSchedule("s1");
    await notificationsApi.resumeSchedule("s1");
    await notificationsApi.cancelSchedule("s1");
    expect(apiFetch.mock.calls).toEqual([
      ["/notifications/schedules", { method: "POST", body: input }],
      ["/notifications/schedules/preview", { method: "POST", body: input }],
      ["/notifications/schedules/s1"],
      ["/notifications/schedules/s1", { method: "PATCH", body: { title: "x" } }],
      ["/notifications/schedules/s1/pause", { method: "POST" }],
      ["/notifications/schedules/s1/resume", { method: "POST" }],
      ["/notifications/schedules/s1", { method: "DELETE" }],
    ]);
  });

  it("body never carries farmId", async () => {
    await notificationsApi.createSchedule({ title: "t", trigger: "DATE", audience: { mode: "USER", user_id: "u" } });
    expect(JSON.stringify(apiFetch.mock.calls[0])).not.toContain("farmId");
  });
});

describe("qk.notifications v2 keys", () => {
  it("nest under the prefixes used for invalidation and leave the inbox keys alone", () => {
    expect(qk.notifications.schedules({ scope: "mine" }).slice(0, 2)).toEqual(qk.notifications.schedulesAll());
    expect(qk.notifications.schedule("s1").slice(0, 2)).toEqual(qk.notifications.schedulesAll());
    expect(qk.notifications.upcoming({ from: "a" }).slice(0, 2)).toEqual(qk.notifications.upcomingAll());
    expect(qk.notifications.list("all", 1, "bn").slice(0, 2)).toEqual(["notifications", "list"]);
    expect(qk.notifications.upcoming({ from: "a" })).not.toEqual(qk.notifications.upcoming({ from: "b" }));
  });
});
