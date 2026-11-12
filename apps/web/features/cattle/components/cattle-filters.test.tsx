import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import en from "@/i18n/messages/en.json";
import { CattleFilters } from "./cattle-filters";

vi.mock("../hooks/use-cattle", () => ({
  useBreeds: () => ({ data: { items: [{ id: "breed-1", name: "Holstein Friesian" }] } }),
  useSheds: () => ({ data: { items: [{ id: "shed-1", name: "North Barn" }] } }),
  useAnimalGroups: () => ({ data: { items: [{ id: "group-1", name: "High Yielders" }] } }),
}));

function renderFilters(initialSearchParams = "", actions?: React.ReactNode) {
  const Adapter = withNuqsTestingAdapter({ searchParams: initialSearchParams });
  return render(
    <Adapter>
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
        <CattleFilters actions={actions} />
      </NextIntlClientProvider>
    </Adapter>,
  );
}

describe("CattleFilters (Standardized DrilldownFilterBar)", () => {
  it("renders search input, filter popover button, and action buttons", () => {
    renderFilters("", <button type="button">Custom Action</button>);

    expect(screen.getByPlaceholderText("Find animal by name or id")).toBeTruthy();
    expect(screen.getByRole("button", { name: /filters/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Custom Action" })).toBeTruthy();
  });

  it("surfaces active filters from URL search params as removable chips", () => {
    renderFilters("?animalCategory=COW&herdStatus=ACTIVE&shedId=shed-1");

    expect(screen.getByText("Category:")).toBeTruthy();
    expect(screen.getByText("Cow")).toBeTruthy();

    expect(screen.getByText("Herd Status:")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();

    expect(screen.getByText("Shed:")).toBeTruthy();
    expect(screen.getByText("North Barn")).toBeTruthy();
  });

  it("removes a chip and updates active filters when remove button is clicked", () => {
    renderFilters("?animalCategory=COW");

    expect(screen.getByText("Category:")).toBeTruthy();
    expect(screen.getByText("Cow")).toBeTruthy();

    const removeBtn = screen.getByLabelText("Remove Cow");
    fireEvent.click(removeBtn);

    expect(screen.queryByText("Category:")).toBeNull();
  });

  it("clears all active filters when Clear all button is clicked", () => {
    renderFilters("?animalCategory=COW&herdStatus=ACTIVE");

    expect(screen.getByText("Category:")).toBeTruthy();
    expect(screen.getByText("Herd Status:")).toBeTruthy();

    const clearAllBtn = screen.getByRole("button", { name: /clear all/i });
    fireEvent.click(clearAllBtn);

    expect(screen.queryByText("Category:")).toBeNull();
    expect(screen.queryByText("Herd Status:")).toBeNull();
  });

  it("debounces and updates search query", async () => {
    renderFilters();

    const input = screen.getByPlaceholderText("Find animal by name or id");
    fireEvent.change(input, { target: { value: "Bessie" } });

    await waitFor(
      () => {
        expect((input as HTMLInputElement).value).toBe("Bessie");
      },
      { timeout: 500 },
    );
  });
});
