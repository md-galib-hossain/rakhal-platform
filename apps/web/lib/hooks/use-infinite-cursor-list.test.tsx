import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ApiError } from "@/lib/api/errors";
import { dedupeById, shouldRetryInfinite, useInfiniteCursorList } from "./use-infinite-cursor-list";

interface Row {
  id: string;
}
type Page = { items: Row[]; meta: { hasNextPage: boolean; endCursor: string | null } };

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const page = (ids: string[], next: string | null): Page => ({
  items: ids.map((id) => ({ id })),
  meta: { hasNextPage: next !== null, endCursor: next },
});

describe("useInfiniteCursorList", () => {
  it("walks cursors, appends, and stops at the end", async () => {
    const fetchPage = vi.fn(async (cursor: string | undefined) =>
      cursor === undefined ? page(["a", "b"], "c1") : page(["c"], null),
    );
    const { result } = renderHook(() => useInfiniteCursorList(["t"], fetchPage), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.items.map((r) => r.id)).toEqual(["a", "b"]));
    expect(result.current.hasNextPage).toBe(true);

    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.items.map((r) => r.id)).toEqual(["a", "b", "c"]));
    expect(result.current.hasNextPage).toBe(false);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage).toHaveBeenLastCalledWith("c1", 20);
  });

  it("stops on a repeated cursor instead of looping", async () => {
    const fetchPage = vi.fn(async (cursor: string | undefined) =>
      cursor === undefined ? page(["a"], "same") : page(["b"], "same"),
    );
    const { result } = renderHook(() => useInfiniteCursorList(["t2"], fetchPage), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("dedupes rows that shift across a page boundary", async () => {
    const fetchPage = async (cursor: string | undefined) =>
      cursor === undefined ? page(["a", "b"], "c1") : page(["b", "c"], null);
    const { result } = renderHook(() => useInfiniteCursorList(["t3"], fetchPage), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.items.map((r) => r.id)).toEqual(["a", "b", "c"]));
  });

  it("keeps loaded rows on a next-page failure and resumes from the same cursor on retry", async () => {
    let fail = true;
    const fetchPage = vi.fn(async (cursor: string | undefined) => {
      if (cursor === undefined) return page(["a"], "c1");
      if (fail) throw new ApiError("VALIDATION_ERROR", "bad", 400);
      return page(["b"], null);
    });
    const { result } = renderHook(() => useInfiniteCursorList(["t4"], fetchPage), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.isNextPageError).toBe(true));
    expect(result.current.items.map((r) => r.id)).toEqual(["a"]);
    expect(result.current.isError).toBe(false);

    fail = false;
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.items.map((r) => r.id)).toEqual(["a", "b"]));
    expect(fetchPage).toHaveBeenLastCalledWith("c1", 20);
  });

  it("starts from the first page with no stale rows when the key changes", async () => {
    const { result, rerender } = renderHook(
      ({ f }: { f: string }) => useInfiniteCursorList(["t5", f], async () => page([f], null)),
      { wrapper: wrapper(), initialProps: { f: "one" } },
    );
    await waitFor(() => expect(result.current.items.map((r) => r.id)).toEqual(["one"]));
    rerender({ f: "two" });
    expect(result.current.items).toEqual([]);
    await waitFor(() => expect(result.current.items.map((r) => r.id)).toEqual(["two"]));
  });
});

describe("helpers", () => {
  it("never retries 4xx except 429, retries transient twice", () => {
    expect(shouldRetryInfinite(0, new ApiError("VALIDATION_ERROR", "x", 400))).toBe(false);
    expect(shouldRetryInfinite(0, new ApiError("FORBIDDEN", "x", 403))).toBe(false);
    expect(shouldRetryInfinite(0, new ApiError("RATE_LIMITED", "x", 429))).toBe(true);
    expect(shouldRetryInfinite(1, new Error("net"))).toBe(true);
    expect(shouldRetryInfinite(2, new Error("net"))).toBe(false);
  });
  it("dedupeById keeps first occurrence order", () => {
    expect(dedupeById([{ id: "a" }, { id: "b" }, { id: "a" }]).map((r) => r.id)).toEqual(["a", "b"]);
  });
});
