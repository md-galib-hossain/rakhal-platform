import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import { InfiniteScrollFooter, type InfiniteScrollFooterProps } from "./infinite-scroll-footer";

type IOCallback = (entries: Array<{ isIntersecting: boolean }>) => void;
let observers: Array<{ cb: IOCallback; disconnect: ReturnType<typeof vi.fn> }> = [];

beforeEach(() => {
  observers = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      disconnect = vi.fn();
      observe = vi.fn();
      constructor(cb: IOCallback) {
        observers.push({ cb, disconnect: this.disconnect });
      }
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

function setup(props: Partial<InfiniteScrollFooterProps> = {}) {
  const onLoadMore = vi.fn();
  const ui = (p: Partial<InfiniteScrollFooterProps>) => (
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
      <InfiniteScrollFooter hasNextPage isFetchingNextPage={false} onLoadMore={onLoadMore} {...props} {...p} />
    </NextIntlClientProvider>
  );
  const view = render(ui({}));
  return { onLoadMore, rerender: (p: Partial<InfiniteScrollFooterProps>) => view.rerender(ui(p)) };
}

describe("InfiniteScrollFooter", () => {
  it("loads when the sentinel intersects", () => {
    const { onLoadMore } = setup();
    act(() => observers.at(-1)!.cb([{ isIntersecting: true }]));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("ignores non-intersecting callbacks", () => {
    const { onLoadMore } = setup();
    act(() => observers.at(-1)!.cb([{ isIntersecting: false }]));
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("disarms while fetching and after an error (no runaway loop)", () => {
    const { rerender } = setup();
    const armed = observers.length;
    rerender({ isFetchingNextPage: true });
    expect(observers[armed - 1]!.disconnect).toHaveBeenCalled();
    expect(observers.length).toBe(armed);
    rerender({ isFetchingNextPage: false, isError: true });
    expect(observers.length).toBe(armed);
  });

  it("creates no observer when there is no next page and announces the end", () => {
    setup({ hasNextPage: false, loadedCount: 7 });
    expect(observers).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent("All 7 loaded");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("Load more button works without scrolling; error state offers Retry", async () => {
    const user = userEvent.setup();
    const { onLoadMore, rerender } = setup();
    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    rerender({ isError: true });
    expect(screen.getByRole("status")).toHaveTextContent("Could not load more");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onLoadMore).toHaveBeenCalledTimes(2);
  });
});
