import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { FilterBar } from "./filter-bar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

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
      { wrapper: withNuqsTestingAdapter() },
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

    render(<FilterBar searchKey="q" />, {
      wrapper: withNuqsTestingAdapter({ onUrlUpdate }),
    });

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
