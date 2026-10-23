import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("options mode: shows caller shortcuts and reports the picked one", async () => {
    const onOptionSelect = vi.fn();
    const today = new Date(2026, 9, 23);
    render(
      <DateRangePicker
        range={{ from: today, to: today }}
        label="All Dates"
        options={[
          { id: "all", label: "All Dates", range: null },
          { id: "tomorrow", label: "Tomorrow", range: { from: today, to: today } },
        ]}
        activeOptionId="all"
        onOptionSelect={onOptionSelect}
        onRangeChange={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /All Dates/ }));
    await userEvent.click(screen.getByRole("button", { name: "Tomorrow" }));
    expect(onOptionSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "tomorrow" }));
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
