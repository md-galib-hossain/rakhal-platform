import { describe, expect, it } from "vitest";
import { listPhase, parseView, reminderAudience, reminderRepeat, reminderServerFilters } from "./reminder-view";


describe("task hub reminder view model", () => {
  it("defaults the segment to tasks", () => {
    expect(parseView(null)).toBe("tasks");
    expect(parseView("bogus")).toBe("tasks");
    expect(parseView("reminders")).toBe("reminders");
  });
  it("maps every reminder tab to an exact server query with no client clock", () => {
    const open = "PENDING,IN_PROGRESS,BLOCKED";
    expect(reminderServerFilters("overdue")).toEqual({ kind: "reminder", filter: "overdue", sortOrder: "asc" });
    expect(reminderServerFilters("upcoming")).toEqual({ kind: "reminder", filter: "upcoming", sortOrder: "asc" });
    expect(reminderServerFilters("repeating")).toEqual({ kind: "reminder", status: open, recurring: true, sortOrder: "asc" });
    expect(reminderServerFilters("done")).toEqual({ kind: "reminder", status: "COMPLETED,CANCELLED", sortOrder: "desc" });
    // Time-independent: identical on every call (a changing key is what blanked the Upcoming tab).
    expect(reminderServerFilters("upcoming")).toEqual(reminderServerFilters("upcoming"));
  });
  it("picks the list phase: error beats skeleton, empty only after load", () => {
    expect(listPhase({ isError: true, isLoading: false, itemCount: 0 })).toBe("error");
    expect(listPhase({ isError: false, isLoading: false, itemCount: 0, isNextPageError: true })).toBe("error");
    expect(listPhase({ isError: false, isLoading: true, itemCount: 0 })).toBe("loading");
    expect(listPhase({ isError: false, isLoading: false, itemCount: 0 })).toBe("empty");
    expect(listPhase({ isError: false, isLoading: false, itemCount: 3, isNextPageError: true })).toBe("list");
  });
  it("describes repeat and audience", () => {
    expect(reminderRepeat({ recurring: false, recurrenceType: null, recurrenceIntervalDays: null })).toBeNull();
    expect(reminderRepeat({ recurring: true, recurrenceType: "EVERY_N_DAYS", recurrenceIntervalDays: 7 })).toEqual({ type: "everyN", n: 7 });
    expect(reminderRepeat({ recurring: true, recurrenceType: "DAILY", recurrenceIntervalDays: null })).toEqual({ type: "everyN", n: 1 });
    expect(reminderAudience({ recipientUserIds: ["a", "b"], notifyRoleNames: ["Owner"], assignedTo: null })).toEqual({ type: "people", count: 2 });
    expect(reminderAudience({ recipientUserIds: [], notifyRoleNames: ["Owner"], assignedTo: null })).toEqual({ type: "roles", roles: ["Owner"] });
    expect(reminderAudience({ assignedTo: { id: "1", name: "Rina" } })).toEqual({ type: "assignee", name: "Rina" });
  });
});
