import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DateRangePicker } from "./date-range-picker";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

describe("DateRangePicker", () => {
  it("renders the trigger with the given label", () => {
    render(
      <DateRangePicker
        preset="this_month"
        range={{ from: new Date(2026, 7, 1), to: new Date(2026, 7, 26) }}
        label="This Month"
        onPresetChange={vi.fn()}
        onRangeChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /This Month/ })).toBeInTheDocument();
  });

  it("disables the trigger when disabled is set", () => {
    render(
      <DateRangePicker
        preset="today"
        range={{ from: new Date(), to: new Date() }}
        label="Today"
        onPresetChange={vi.fn()}
        onRangeChange={vi.fn()}
        disabled
      />,
    );
    expect(screen.getByRole("button", { name: /Today/ })).toBeDisabled();
  });
});
