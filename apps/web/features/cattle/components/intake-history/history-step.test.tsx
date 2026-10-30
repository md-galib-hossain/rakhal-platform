import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import bn from "@/i18n/messages/bn.json";
import { HistoryStep } from "./history-step";
import type { HistoryValues } from "./history-model";

// jsdom has no ResizeObserver; Radix checkbox / popover need one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function Harness({ gender, initial = {} }: { gender: string; initial?: HistoryValues }) {
  const [values, setValues] = useState<HistoryValues>(initial);
  return <HistoryStep gender={gender} values={values} onChange={(patch) => setValues((previous) => ({ ...previous, ...patch }))} today="2026-10-30" />;
}

function renderStep(gender: string, initial?: HistoryValues, locale: "en" | "bn" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : bn} timeZone="Asia/Dhaka">
      <Harness gender={gender} initial={initial} />
    </NextIntlClientProvider>,
  );
}

describe("HistoryStep", () => {
  it("a female sees the full set, nothing required, and an empty preview", () => {
    renderStep("FEMALE");
    expect(screen.getByText("Her history (optional)")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Has she calved before?" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Is she pregnant?" })).toBeInTheDocument();
    expect(screen.getByText("Nothing to set up yet. Answer above, or skip.")).toBeInTheDocument();
  });

  it("a male reads His history and gets only the vaccination field", () => {
    renderStep("MALE");
    expect(screen.getByText("His history (optional)")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Has she calved before?" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Is she pregnant?" })).not.toBeInTheDocument();
    expect(screen.getByText("Last vaccination (optional)")).toBeInTheDocument();
  });

  it("fields follow the answers: calved yes reveals calving and milking questions", () => {
    renderStep("FEMALE");
    expect(screen.queryByText("Number of calvings")).not.toBeInTheDocument();
    fireEvent.click(within("Has she calved before?", "Yes"));
    expect(screen.getByText("Number of calvings")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Is she milking now?" })).toBeInTheDocument();
    fireEvent.click(within("Is she milking now?", "No"));
    expect(screen.getByText("Dry since")).toBeInTheDocument();
  });

  it("pregnant 2 months previews a calving due date and a dry-off reminder", () => {
    renderStep("FEMALE");
    fireEvent.click(within("Is she pregnant?", "Yes"));
    fireEvent.change(screen.getByLabelText("Months pregnant"), { target: { value: "2" } });
    expect(screen.getByText(/Pregnant, calving due/)).toBeInTheDocument();
    expect(screen.getByText(/Dry-off reminder/)).toBeInTheDocument();
    expect(screen.queryByText(/AI \/ service \d/)).not.toBeInTheDocument();
  });

  it("history rows are tagged, and the month-only switch swaps the date input", () => {
    renderStep("FEMALE", { calvedBefore: "yes", lastCalvingDate: "2026-06-10" });
    expect(screen.getByText(/Calving/)).toBeInTheDocument();
    expect(screen.getByText("(history)")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("checkbox", { name: "I only know the month" })[0]);
    expect((document.querySelector('input[type="month"]') as HTMLInputElement).value).toBe("2026-06");
  });

  it("renders in Bangla", () => {
    renderStep("FEMALE", undefined, "bn");
    expect(screen.getByText("তার ইতিহাস (ঐচ্ছিক)")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "আগে কি বাচ্চা দিয়েছে?" })).toBeInTheDocument();
  });
});

/** The Yes / No button inside a named radio group. */
function within(group: string, label: string): HTMLElement {
  const container = screen.getByRole("radiogroup", { name: group });
  const button = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === label);
  if (!button) throw new Error(`${label} not found in ${group}`);
  return button as HTMLElement;
}
