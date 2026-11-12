import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import { PlanProportionBar } from "./plan-proportion-bar";
import type { FeedPlanLine } from "../../plans-types";

function renderWithIntl(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const mockLines: FeedPlanLine[] = [
  {
    id: "l1",
    line_type: "FEED_ITEM",
    feed_item_id: "fi-1",
    concentration_id: null,
    name: "Corn Silage",
    recipe_kind: null,
    kg_per_day: 25,
    sort_order: 1,
  },
  {
    id: "l2",
    line_type: "FEED_ITEM",
    feed_item_id: "fi-2",
    concentration_id: null,
    name: "Dairy Meal",
    recipe_kind: null,
    kg_per_day: 10,
    sort_order: 2,
  },
  {
    id: "l3",
    line_type: "FEED_ITEM",
    feed_item_id: "fi-3",
    concentration_id: null,
    name: "Rice Straw",
    recipe_kind: null,
    kg_per_day: 5,
    sort_order: 3,
  },
  {
    id: "l4",
    line_type: "FEED_ITEM",
    feed_item_id: "fi-4",
    concentration_id: null,
    name: "Mineral Mix",
    recipe_kind: null,
    kg_per_day: 1,
    sort_order: 4,
  },
];

describe("PlanProportionBar", () => {
  it("renders progressbar with segments and calculated percentages", () => {
    renderWithIntl(<PlanProportionBar lines={mockLines} totalKg={41} showLegend={true} />);

    const bar = screen.getByRole("progressbar");
    expect(bar).toBeInTheDocument();

    // Check legend items (up to 3)
    expect(screen.getByText("Corn Silage")).toBeInTheDocument();
    expect(screen.getByText("Dairy Meal")).toBeInTheDocument();
    expect(screen.getByText("Rice Straw")).toBeInTheDocument();

    // Fourth item is hidden and reported as "+1 more ingredients"
    expect(screen.getByText("+1 more ingredients")).toBeInTheDocument();
  });

  it("handles zero totalKg and empty lines without crashing", () => {
    renderWithIntl(<PlanProportionBar lines={[]} totalKg={0} showLegend={true} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toBeInTheDocument();
  });

  it("calculates total from lines when totalKg is 0", () => {
    const singleLine: FeedPlanLine[] = [
      {
        id: "l1",
        line_type: "FEED_ITEM",
        feed_item_id: "fi-1",
        concentration_id: null,
        name: "Alfalfa Hay",
        recipe_kind: null,
        kg_per_day: 12.5,
        sort_order: 1,
      },
    ];
    renderWithIntl(<PlanProportionBar lines={singleLine} totalKg={0} showLegend={true} />);

    expect(screen.getByText("Alfalfa Hay")).toBeInTheDocument();
    expect(screen.getByText("12.5 kg (100.0%)")).toBeInTheDocument();
  });

  it("filters out zero kg lines from segments", () => {
    const linesWithZero: FeedPlanLine[] = [
      {
        id: "l1",
        line_type: "FEED_ITEM",
        feed_item_id: "fi-1",
        concentration_id: null,
        name: "Active Feed",
        recipe_kind: null,
        kg_per_day: 10,
        sort_order: 1,
      },
      {
        id: "l2",
        line_type: "FEED_ITEM",
        feed_item_id: "fi-2",
        concentration_id: null,
        name: "Zero Feed",
        recipe_kind: null,
        kg_per_day: 0,
        sort_order: 2,
      },
    ];
    renderWithIntl(<PlanProportionBar lines={linesWithZero} totalKg={10} showLegend={true} />);

    expect(screen.getByText("Active Feed")).toBeInTheDocument();
    expect(screen.queryByText("Zero Feed")).not.toBeInTheDocument();
  });

  it("handles very long ingredient names with truncate and title attributes", () => {
    const longName = "Ultra-Premium High-Energy Extruded Rapeseed Byproduct Meal Mix";
    const longLines: FeedPlanLine[] = [
      {
        id: "l1",
        line_type: "FEED_ITEM",
        feed_item_id: "fi-1",
        concentration_id: null,
        name: longName,
        recipe_kind: null,
        kg_per_day: 15,
        sort_order: 1,
      },
    ];
    renderWithIntl(<PlanProportionBar lines={longLines} totalKg={15} showLegend={true} />);

    const labelEl = screen.getByText(longName);
    expect(labelEl).toBeInTheDocument();
    expect(labelEl).toHaveAttribute("title", longName);
    expect(labelEl).toHaveClass("truncate");
  });

  it("hides legend when showLegend is false", () => {
    renderWithIntl(<PlanProportionBar lines={mockLines} totalKg={41} showLegend={false} />);

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.queryByText("Corn Silage")).not.toBeInTheDocument();
    expect(screen.queryByText("+1 more ingredients")).not.toBeInTheDocument();
  });

  it("sets aria-valuemin, aria-valuemax, aria-valuenow and tabIndex={0} on interactive segments", () => {
    renderWithIntl(<PlanProportionBar lines={mockLines} totalKg={41} showLegend={true} />);

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "41");
    expect(bar).toHaveAttribute("aria-valuenow", "41");

    // All segments should be keyboard focusable
    const segment = screen.getByLabelText(/Corn Silage: 25.0 kg/);
    expect(segment).toHaveAttribute("tabindex", "0");
  });
});

