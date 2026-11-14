import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  DrilldownFilterChips,
  DrilldownFilterPopover,
  type FilterCategoryConfig,
} from "./drilldown-filter-popover";

const mockCategories: FilterCategoryConfig[] = [
  {
    id: "condition",
    label: "Condition",
    mode: "multi",
    searchable: true,
    searchPlaceholder: "Search conditions…",
    options: [
      { value: "MASTITIS", label: "Mastitis" },
      { value: "LAMENESS", label: "Lameness" },
      { value: "FEVER", label: "Fever" },
    ],
  },
  {
    id: "priority",
    label: "Priority",
    mode: "single",
    options: [
      { value: "CRITICAL", label: "Critical", indicatorColor: "bg-destructive" },
      { value: "HIGH", label: "High", indicatorColor: "bg-warning" },
      { value: "LOW", label: "Low" },
    ],
  },
];

describe("DrilldownFilterPopover", () => {
  it("renders trigger and opens root panel with categories", () => {
    render(
      <DrilldownFilterPopover
        categories={mockCategories}
        value={{}}
        onChange={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Filter" });
    expect(trigger).toBeTruthy();
    fireEvent.click(trigger);

    expect(screen.getByText("Add Filters")).toBeTruthy();
    expect(screen.getByText("Condition")).toBeTruthy();
    expect(screen.getByText("Priority")).toBeTruthy();
  });

  it("drills down to category sub-panel when clicked and allows selecting options", async () => {
    const handleChange = vi.fn();
    render(
      <DrilldownFilterPopover
        categories={mockCategories}
        value={{}}
        onChange={handleChange}
      />,
    );

    // Open popover
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));

    // Click Condition category
    fireEvent.click(screen.getByText("Condition"));

    // Sub-panel should show back button and options
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Condition/ })).toBeTruthy();
      expect(screen.getByText("Mastitis")).toBeTruthy();
    });

    // Select Mastitis
    fireEvent.click(screen.getByText("Mastitis"));
    expect(handleChange).toHaveBeenCalledWith({ condition: ["MASTITIS"] });
  });

  it("shows selection summary on root panel when filters are active", () => {
    render(
      <DrilldownFilterPopover
        categories={mockCategories}
        value={{ condition: ["MASTITIS", "LAMENESS"], priority: ["CRITICAL"] }}
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Filter/ }));
    expect(screen.getByText("Mastitis, Lameness")).toBeTruthy();
    expect(screen.getByText("Critical")).toBeTruthy();
  });

  it("clears all filters when Clear All is clicked", () => {
    const handleChange = vi.fn();
    render(
      <DrilldownFilterPopover
        categories={mockCategories}
        value={{ priority: ["CRITICAL"] }}
        onChange={handleChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Filter/ }));
    fireEvent.click(screen.getByText("Clear All"));
    expect(handleChange).toHaveBeenCalledWith({});
  });
});

describe("DrilldownFilterChips", () => {
  it("renders active filter chips with category labels and allows removing", () => {
    const handleChange = vi.fn();
    const handleClearAll = vi.fn();

    render(
      <DrilldownFilterChips
        categories={mockCategories}
        value={{ condition: ["MASTITIS"], priority: ["CRITICAL"] }}
        onChange={handleChange}
        onClearAll={handleClearAll}
      />,
    );

    expect(screen.getByText("Condition:")).toBeTruthy();
    expect(screen.getByText("Mastitis")).toBeTruthy();
    expect(screen.getByText("Priority:")).toBeTruthy();
    expect(screen.getByText("Critical")).toBeTruthy();

    // Click remove on Mastitis
    const removeMastitis = screen.getByRole("button", { name: "Remove Mastitis" });
    fireEvent.click(removeMastitis);
    expect(handleChange).toHaveBeenCalledWith({ priority: ["CRITICAL"] });

    // Click Clear all
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(handleClearAll).toHaveBeenCalled();
  });
});
