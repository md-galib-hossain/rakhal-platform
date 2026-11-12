import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { REPORTS_LIST_POLL_MS, hasPendingReports, useReportsListPolling } from "./use-reports-list-polling";

const row = (status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED") => ({ status });

describe("hasPendingReports", () => {
  it("is true only for QUEUED / PROCESSING rows", () => {
    expect(hasPendingReports([row("COMPLETED"), row("FAILED")])).toBe(false);
    expect(hasPendingReports([row("COMPLETED"), row("QUEUED")])).toBe(true);
    expect(hasPendingReports([row("PROCESSING")])).toBe(true);
    expect(hasPendingReports([])).toBe(false);
  });
});

describe("useReportsListPolling", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("refetches on an interval while something is generating", () => {
    const refetch = vi.fn();
    renderHook(() => useReportsListPolling([row("PROCESSING")], refetch));
    vi.advanceTimersByTime(REPORTS_LIST_POLL_MS * 3);
    expect(refetch).toHaveBeenCalledTimes(3);
  });

  it("never polls when nothing is in progress", () => {
    const refetch = vi.fn();
    renderHook(() => useReportsListPolling([row("COMPLETED"), row("FAILED")], refetch));
    vi.advanceTimersByTime(REPORTS_LIST_POLL_MS * 5);
    expect(refetch).not.toHaveBeenCalled();
  });

  it("stops as soon as the last in-progress report finishes", () => {
    const refetch = vi.fn();
    const { rerender } = renderHook(({ rows }) => useReportsListPolling(rows, refetch), {
      initialProps: { rows: [row("QUEUED")] },
    });
    vi.advanceTimersByTime(REPORTS_LIST_POLL_MS);
    expect(refetch).toHaveBeenCalledTimes(1);
    rerender({ rows: [row("COMPLETED")] });
    vi.advanceTimersByTime(REPORTS_LIST_POLL_MS * 5);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("skips ticks while the tab is hidden", () => {
    const refetch = vi.fn();
    const spy = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    renderHook(() => useReportsListPolling([row("PROCESSING")], refetch));
    vi.advanceTimersByTime(REPORTS_LIST_POLL_MS * 2);
    expect(refetch).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
