import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useIncrementalReveal } from "./use-incremental-reveal";

const rows = Array.from({ length: 20 }, (_, i) => i);

describe("useIncrementalReveal", () => {
  it("shows the first step, then grows by one step per showMore until exhausted", () => {
    const { result } = renderHook(() => useIncrementalReveal(rows, 8));
    expect(result.current.visible).toHaveLength(8);
    expect(result.current.hasMore).toBe(true);
    act(() => result.current.showMore());
    expect(result.current.visible).toHaveLength(16);
    act(() => result.current.showMore());
    expect(result.current.visible).toHaveLength(20);
    expect(result.current.hasMore).toBe(false);
  });

  it("collapses to the first step when resetKey changes", () => {
    const { result, rerender } = renderHook(({ k }) => useIncrementalReveal(rows, 5, k), { initialProps: { k: "a" } });
    act(() => result.current.showMore());
    expect(result.current.visible).toHaveLength(10);
    rerender({ k: "b" });
    expect(result.current.visible).toHaveLength(5);
  });

  it("has nothing more for a list shorter than one step", () => {
    const { result } = renderHook(() => useIncrementalReveal([1, 2, 3], 8));
    expect(result.current.visible).toEqual([1, 2, 3]);
    expect(result.current.hasMore).toBe(false);
  });
});
