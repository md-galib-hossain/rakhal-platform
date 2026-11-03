import { describe, expect, it } from "vitest";
import { editedDueAt, localDateOf } from "./due-date";

// vitest runs with TZ=Asia/Dhaka? Force check: these assertions hold in any zone via the offset below.
const iso = "2026-11-04T19:06:00.000Z"; // Nov 5 01:06 in UTC+6
const offsetMin = -new Date(iso).getTimezoneOffset();

describe("task due date round trip", () => {
  it("prefills the local day, not the UTC day", () => {
    const expected = new Date(new Date(iso).getTime() + offsetMin * 60000).toISOString().slice(0, 10);
    expect(localDateOf(iso)).toBe(expected);
  });
  it("in Dhaka (UTC+6) an evening-UTC instant is the next local day", () => {
    if (offsetMin !== 360) return; // run with TZ=Asia/Dhaka to exercise
    expect(localDateOf(iso)).toBe("2026-11-05");
  });
  it("an untouched date keeps dueAt byte-identical", () => {
    expect(editedDueAt(iso, localDateOf(iso))).toBe(iso);
  });
  it("a changed date keeps the local time of day", () => {
    const next = editedDueAt(iso, "2026-12-01");
    const d = new Date(next);
    const o = new Date(iso);
    expect([d.getHours(), d.getMinutes()]).toEqual([o.getHours(), o.getMinutes()]);
    expect(d.getDate()).toBe(1);
    expect(d.getMonth()).toBe(11);
  });
});
