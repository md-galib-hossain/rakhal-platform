import { describe, expect, it } from "vitest";
import { buildPlanFeature, buildPlanUpdate, buildSubscriptionAction } from "./commercial-request";

const reason = "Commercial agreement signed (ticket 5120)";
const base = { reason, confirm: "Green Valley Dairy" };

describe("buildSubscriptionAction", () => {
  it("activate needs a plan and a billing period", () => {
    expect(buildSubscriptionAction("activate", "f1", { ...base, planId: "p1", period: "YEARLY" })).toEqual({
      ok: true,
      method: "POST",
      path: "/admin/farms/f1/subscription/activate",
      body: { ...base, planId: "p1", period: "YEARLY" },
    });
    expect(buildSubscriptionAction("activate", "f1", { ...base, planId: "", period: "MONTHLY" }).ok).toBe(false);
    expect(buildSubscriptionAction("activate", "f1", { ...base, planId: "p1", period: "WEEKLY" }).ok).toBe(false);
  });

  it("comp and extend coerce days from form text and bound them", () => {
    const comp = buildSubscriptionAction("comp", "f1", { ...base, planId: "p1", days: "30" });
    expect(comp.ok && comp.body.days).toBe(30);
    const extend = buildSubscriptionAction("extend", "f1", { ...base, days: "10" });
    expect(extend.ok && extend.path).toBe("/admin/farms/f1/subscription/extend");
    for (const days of ["0", "366", "1.5", "abc", ""]) {
      expect(buildSubscriptionAction("extend", "f1", { ...base, days }).ok).toBe(false);
    }
  });

  it("cancel needs only a reason and the confirmation", () => {
    expect(buildSubscriptionAction("cancel", "f1", base).ok).toBe(true);
    const short = buildSubscriptionAction("cancel", "f1", { reason: "short", confirm: "x" });
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.errors.reason).toMatch(/10 characters/);
    expect(buildSubscriptionAction("cancel", "f1", { reason, confirm: "  " }).ok).toBe(false);
  });

  it("encodes the farm id and drops unknown fields", () => {
    const res = buildSubscriptionAction("cancel", "a/b", { ...base, planId: "ignored", isAdmin: true });
    expect(res.ok && res.path).toBe("/admin/farms/a%2Fb/subscription/cancel");
    expect(res.ok && Object.keys(res.body).sort()).toEqual(["confirm", "reason"]);
  });
});

describe("buildPlanUpdate", () => {
  it("sends only the fields that were filled in, as numbers", () => {
    const res = buildPlanUpdate("p1", { reason, monthlyPrice: "150", yearlyPrice: "", maxCattle: "80", maxFarmMembers: "", description: "" });
    expect(res).toEqual({ ok: true, method: "PATCH", path: "/admin/plans/p1", body: { reason, monthlyPrice: 150, maxCattle: 80 } });
  });
  it("refuses an edit that changes nothing", () => {
    const res = buildPlanUpdate("p1", { reason, monthlyPrice: "", yearlyPrice: "", maxCattle: "", maxFarmMembers: "" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.form).toMatch(/at least one/i);
  });
  it.each([
    ["monthlyPrice", "-1"],
    ["monthlyPrice", "abc"],
    ["maxCattle", "1.5"],
    ["maxFarmMembers", "0"],
  ])("rejects %s = %s", (field, value) => {
    const res = buildPlanUpdate("p1", { reason, monthlyPrice: "", yearlyPrice: "", maxCattle: "", maxFarmMembers: "", [field]: value });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors[field]).toBeTruthy();
  });
  it("requires a reason", () => {
    expect(buildPlanUpdate("p1", { reason: "no", monthlyPrice: "5", yearlyPrice: "", maxCattle: "", maxFarmMembers: "" }).ok).toBe(false);
  });
});

describe("buildPlanFeature", () => {
  it("builds a PUT with the new state when the key matches", () => {
    expect(buildPlanFeature("p1", "milk.export", true, { reason, confirm: "milk.export" })).toEqual({
      ok: true,
      method: "PUT",
      path: "/admin/plans/p1/features/milk.export",
      body: { enabled: true, reason },
    });
  });
  it("requires the exact feature key", () => {
    expect(buildPlanFeature("p1", "milk.export", false, { reason, confirm: "milk" }).ok).toBe(false);
  });
});
