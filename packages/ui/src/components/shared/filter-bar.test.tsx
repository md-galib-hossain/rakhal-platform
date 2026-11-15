import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { useQueryState as useNuqsQueryState, parseAsString } from "nuqs";
import { QueryStateProvider, type QueryStateApi } from "../../lib/query-state";
import { FilterBar } from "./filter-bar";

// This package never imports next/navigation — only apps/web's real adapter does. These two
// tests never assert on the active-filter count or "clear all", so a fixed empty snapshot and a
// no-op clear are enough; useQueryState is the only one that needs real (nuqs-backed) behaviour.
function useTestQueryStateApi(): QueryStateApi {
  return {
    useQueryState: (key, defaultValue) =>
      useNuqsQueryState(key, defaultValue !== undefined ? parseAsString.withDefault(defaultValue) : parseAsString),
    useSearchParamsSnapshot: () => new URLSearchParams(),
    useClearQueryParams: () => () => {},
  };
}

const NuqsWrapper = withNuqsTestingAdapter();
function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NuqsWrapper>
      <QueryStateProvider api={useTestQueryStateApi()}>{children}</QueryStateProvider>
    </NuqsWrapper>
  );
}

describe("FilterBar", () => {
  it("renders a debounced search input and a Filter popover holding the select filters", async () => {
    render(
      <FilterBar
        searchKey="q"
        searchPlaceholder="Search cattle"
        selects={[
          {
            key: "status",
            label: "Status",
            options: [
              { value: "active", label: "Active" },
              { value: "sold", label: "Sold" },
            ],
          },
        ]}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByLabelText("Search cattle")).toBeInTheDocument();
    // Select filters live behind the "Filter" button (Figma's single Filter trigger, not N
    // always-visible selects) — not in the document until opened.
    expect(screen.queryByLabelText("Status")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /filter/i }));
    expect(await screen.findByLabelText("Status")).toBeInTheDocument();
  });

  it("debounces search input changes before syncing to the URL", async () => {
    vi.useFakeTimers();
    const onUrlUpdate = vi.fn();

    function WrapperWithNuqsHook({ children }: { children: React.ReactNode }) {
      const NuqsWrapperWithHook = withNuqsTestingAdapter({ onUrlUpdate });
      return (
        <NuqsWrapperWithHook>
          <QueryStateProvider api={useTestQueryStateApi()}>{children}</QueryStateProvider>
        </NuqsWrapperWithHook>
      );
    }

    render(<FilterBar searchKey="q" />, { wrapper: WrapperWithNuqsHook });

    const input = screen.getByLabelText("Search…");
    fireEvent.change(input, { target: { value: "cow" } });
    expect(onUrlUpdate).not.toHaveBeenCalled();

    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(onUrlUpdate).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
