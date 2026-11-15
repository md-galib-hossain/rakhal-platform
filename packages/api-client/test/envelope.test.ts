import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, NetworkError, isApiEnvelope, isApiErrorBody } from "../src/index.ts";

test("isApiEnvelope accepts success envelopes only", () => {
  assert.equal(isApiEnvelope({ success: true, data: { a: 1 } }), true);
  assert.equal(isApiEnvelope({ success: true, data: null }), true);
  assert.equal(isApiEnvelope({ success: false, message: "x" }), false);
  assert.equal(isApiEnvelope({ success: true }), false);
  assert.equal(isApiEnvelope(null), false);
});

test("isApiErrorBody accepts failure bodies only", () => {
  assert.equal(isApiErrorBody({ success: false, message: "bad", code: "X" }), true);
  assert.equal(isApiErrorBody({ success: true, data: 1 }), false);
  assert.equal(isApiErrorBody("nope"), false);
});

test("ApiError exposes status helpers and falls back to a status message", () => {
  const e = new ApiError(401, { success: false, message: "Unauthorized", code: "AUTH" });
  assert.equal(e.isAuthError, true);
  assert.equal(e.isForbidden, false);
  assert.equal(e.code, "AUTH");
  assert.equal(e.message, "Unauthorized");
  assert.equal(new ApiError(502, null).message, "Request failed (502)");
  assert.equal(new ApiError(403, null).isForbidden, true);
});

test("NetworkError is distinct from ApiError", () => {
  const e = new NetworkError("offline");
  assert.equal(e instanceof ApiError, false);
  assert.equal(e.name, "NetworkError");
});
