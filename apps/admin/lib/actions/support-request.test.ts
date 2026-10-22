import { describe, expect, it } from "vitest";
import { buildSupportRequest, describeSupportError } from "./support-request";

const valid = { reason: "Ticket 4821: abuse reported", confirm: "Green Valley Dairy" };

describe("buildSupportRequest", () => {
  it("builds the path and body for each action", () => {
    expect(buildSupportRequest("farm.suspend", "f1", valid)).toEqual({
      ok: true,
      path: "/admin/farms/f1/suspend",
      body: valid,
    });
    expect(buildSupportRequest("user.block", "u1", valid)).toMatchObject({ path: "/admin/users/u1/block" });
    expect(buildSupportRequest("user.revoke-sessions", "u1", valid)).toMatchObject({
      path: "/admin/users/u1/revoke-sessions",
    });
  });

  it("trims the reason and requires at least 10 characters", () => {
    const short = buildSupportRequest("farm.suspend", "f1", { ...valid, reason: "  too short " });
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.errors.reason).toMatch(/10 characters/);
    const padded = buildSupportRequest("farm.suspend", "f1", { ...valid, reason: "   long enough reason   " });
    expect(padded.ok && padded.body.reason).toBe("long enough reason");
  });

  it("requires a confirmation", () => {
    const res = buildSupportRequest("user.block", "u1", { reason: valid.reason, confirm: "  " });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.confirm).toBeTruthy();
  });

  it("only the password-reset action carries revokeSessions", () => {
    const reset = buildSupportRequest("user.send-password-reset", "u1", { ...valid, revokeSessions: true });
    expect(reset.ok && reset.body.revokeSessions).toBe(true);
    const block = buildSupportRequest("user.block", "u1", { ...valid, revokeSessions: true });
    expect(block.ok && "revokeSessions" in block.body).toBe(false);
    const off = buildSupportRequest("user.send-password-reset", "u1", { ...valid, revokeSessions: false });
    expect(off.ok && "revokeSessions" in off.body).toBe(false);
  });

  it("encodes the target id so it cannot alter the path", () => {
    const res = buildSupportRequest("farm.suspend", "a/../b", valid);
    expect(res.ok && res.path).toBe("/admin/farms/a%2F..%2Fb/suspend");
  });
});

describe("describeSupportError", () => {
  it("explains a confirmation mismatch", () => {
    expect(describeSupportError(400, "Confirmation does not match the farm name")).toMatch(/confirmation/i);
  });
  it("maps statuses without leaking internals", () => {
    expect(describeSupportError(403)).toMatch(/not allowed/);
    expect(describeSupportError(404)).toMatch(/no longer exists/);
    expect(describeSupportError(429)).toMatch(/Too many/);
    expect(describeSupportError(500, "stack trace")).not.toContain("stack trace");
  });
  it("passes a state conflict message through", () => {
    expect(describeSupportError(409, "An archived farm cannot be changed")).toContain("archived");
  });
});
