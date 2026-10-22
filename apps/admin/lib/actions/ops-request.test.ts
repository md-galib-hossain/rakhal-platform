import { describe, expect, it } from "vitest";
import { buildCreateFlag, buildRetryJob, buildSaveSetting, buildToggleFlag } from "./ops-request";

const reason = "Provider outage resolved; replaying";

describe("buildRetryJob", () => {
  it("builds the retry path with encoded ids", () => {
    expect(buildRetryJob("email-queue", "42", { reason, confirm: "42" })).toEqual({
      ok: true,
      method: "POST",
      path: "/admin/ops/queues/email-queue/failed/42/retry",
      body: { reason },
    });
    const odd = buildRetryJob("q", "a/b", { reason, confirm: "a/b" });
    expect(odd.ok && odd.path).toBe("/admin/ops/queues/q/failed/a%2Fb/retry");
  });
  it("needs the exact job id and a real reason", () => {
    const mismatch = buildRetryJob("q", "42", { reason, confirm: "43" });
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) expect(mismatch.errors.confirm).toMatch(/job id/);
    expect(buildRetryJob("q", "42", { reason: "short", confirm: "42" }).ok).toBe(false);
  });
});

describe("buildToggleFlag", () => {
  it("builds a PATCH with the new state", () => {
    expect(buildToggleFlag("milk.v2", true, { reason, confirm: "milk.v2" })).toEqual({
      ok: true,
      method: "PATCH",
      path: "/admin/config/flags/milk.v2",
      body: { enabled: true, reason },
    });
  });
  it("requires the flag key as confirmation", () => {
    expect(buildToggleFlag("milk.v2", false, { reason, confirm: "milk" }).ok).toBe(false);
  });
});

describe("buildCreateFlag", () => {
  it("accepts a valid key and omits an empty description", () => {
    expect(buildCreateFlag({ key: "new_dashboard", description: "", reason })).toEqual({
      ok: true,
      method: "POST",
      path: "/admin/config/flags",
      body: { key: "new_dashboard", reason },
    });
  });
  it.each(["Bad Key", "ab", "1abc", "x".repeat(65)])("rejects key %s", (key) => {
    const res = buildCreateFlag({ key, reason });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.key).toBeTruthy();
  });
});

describe("buildSaveSetting", () => {
  it("parses JSON values", () => {
    const res = buildSaveSetting({ key: "trial.days", value: "14", reason });
    expect(res.ok && res.body.value).toBe(14);
    const obj = buildSaveSetting({ key: "limits.milk", value: '{"max":50}', reason });
    expect(obj.ok && obj.body.value).toEqual({ max: 50 });
    expect(res.ok && res.method).toBe("PUT");
  });
  it("rejects invalid JSON with a helpful message", () => {
    const res = buildSaveSetting({ key: "trial.days", value: "fourteen", reason });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.value).toMatch(/valid JSON/);
  });
  it("validates the key and requires a reason", () => {
    expect(buildSaveSetting({ key: "Bad", value: "1", reason }).ok).toBe(false);
    expect(buildSaveSetting({ key: "trial.days", value: "1", reason: "no" }).ok).toBe(false);
  });
});
