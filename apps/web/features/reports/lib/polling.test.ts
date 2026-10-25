import { describe, expect, it } from "vitest";
import { nextReportPollInterval, REPORT_POLL_INTERVAL_MS, REPORT_POLL_MAX_MS } from "./polling";

describe("nextReportPollInterval", () => {
  it("polls every 2 s while QUEUED or PROCESSING", () => {
    expect(REPORT_POLL_INTERVAL_MS).toBe(2000);
    expect(nextReportPollInterval({ status: "QUEUED", isError: false, elapsedMs: 0 })).toBe(2000);
    expect(nextReportPollInterval({ status: "PROCESSING", isError: false, elapsedMs: 60_000 })).toBe(2000);
  });
  it("stops on terminal statuses", () => {
    expect(nextReportPollInterval({ status: "COMPLETED", isError: false, elapsedMs: 0 })).toBe(false);
    expect(nextReportPollInterval({ status: "FAILED", isError: false, elapsedMs: 0 })).toBe(false);
  });
  it("stops on error, even for a pending status", () => {
    expect(nextReportPollInterval({ status: "PROCESSING", isError: true, elapsedMs: 0 })).toBe(false);
  });
  it("does not poll before the first response", () => {
    expect(nextReportPollInterval({ status: undefined, isError: false, elapsedMs: 0 })).toBe(false);
  });
  it("stops at the 10-minute safety limit", () => {
    expect(REPORT_POLL_MAX_MS).toBe(600_000);
    expect(nextReportPollInterval({ status: "PROCESSING", isError: false, elapsedMs: REPORT_POLL_MAX_MS - 1 })).toBe(2000);
    expect(nextReportPollInterval({ status: "PROCESSING", isError: false, elapsedMs: REPORT_POLL_MAX_MS })).toBe(false);
    expect(nextReportPollInterval({ status: "QUEUED", isError: false, elapsedMs: REPORT_POLL_MAX_MS + 1 })).toBe(false);
  });
});
