import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  DrilldownFilterBar,
  type FilterScopeOption,
} from "./drilldown-filter-bar";
import type { FilterCategoryConfig } from "./drilldown-filter-popover";

const mockScopes: FilterScopeOption[] = [
  { id: "cases", label: "Under treatment", count: 4 },
  { id: "history", label: "Treatment History" },
  { id: "withheld", label: "Milk/meat withheld", count: 0 },
];

const mockCategories: FilterCategoryConfig[] = [
  {
    id: "condition",
    label: "Condition",
    mode: "multi",
    options: [
      { value: "MASTITIS", label: "Mastitis" },
      { value: "LAMENESS", label: "Lameness" },
    ],
  },
  {
    id: "priority",
    label: "Priority",
    mode: "single",
    options: [
      { value: "CRITICAL", label: "Critical" },
      { value: "LOW", label: "Low" },
    ],
  },
];

describe("DrilldownFilterBar", () => {
  it("renders scopes and switches active scope on click", () => {
    const handleScopeChange = vi.fn();
    render(
      <DrilldownFilterBar
        scopes={mockScopes}
        activeScope="cases"
        onScopeChange={handleScopeChange}
        categories={mockCategories}
        filterValues={{}}
        onFilterChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Under treatment")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("Treatment History")).toBeTruthy();
    expect(screen.getByText("Milk/meat withheld")).toBeTruthy();

    fireEvent.click(screen.getByText("Treatment History"));
    expect(handleScopeChange).toHaveBeenCalledWith("history");
  });

  it("handles search input change with debounce", async () => {
    const handleSearchChange = vi.fn();
    render(
      <DrilldownFilterBar
        categories={mockCategories}
        filterValues={{}}
        onFilterChange={vi.fn()}
        search=""
        onSearchChange={handleSearchChange}
        searchPlaceholder="Search cattle…"
      />,
    );

    const input = screen.getByPlaceholderText("Search cattle…");
    fireEvent.change(input, { target: { value: "Cow 101" } });

    await waitFor(
      () => {
        expect(handleSearchChange).toHaveBeenCalledWith("Cow 101");
      },
      { timeout: 500 },
    );
  });

  it("renders actions slot seamlessly", () => {
    render(
      <DrilldownFilterBar
        categories={mockCategories}
        filterValues={{}}
        onFilterChange={vi.fn()}
        actions={<button type="button">Record Treatment</button>}
      />,
    );

    expect(screen.getByRole("button", { name: "Record Treatment" })).toBeTruthy();
  });

  it("renders active filter chips and allows dismissing them", () => {
    const handleFilterChange = vi.fn();
    render(
      <DrilldownFilterBar
        categories={mockCategories}
        filterValues={{ condition: ["MASTITIS"] }}
        onFilterChange={handleFilterChange}
      />,
    );

    expect(screen.getByText("Condition:")).toBeTruthy();
    expect(screen.getByText("Mastitis")).toBeTruthy();

    const removeBtn = screen.getByLabelText("Remove Mastitis");
    fireEvent.click(removeBtn);

    expect(handleFilterChange).toHaveBeenCalledWith({});
  });
});
