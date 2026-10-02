import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import { BulkReportSheet } from "./bulk-report-sheet";

// Radix's checkbox measures itself with ResizeObserver, which jsdom does not have.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  animals: [
    { id: "a1", name: "Lokkhi", tagNumber: "RKL-001" },
    { id: "a2", name: null, tagNumber: "RKL-002" },
    { id: "a3", name: "Bina", tagNumber: "RKL-003" },
  ],
  hasNextPage: false,
}));

vi.mock("@/features/cattle/api", () => ({
  cattleApi: {
    sheds: async () => ({ items: [], meta: {} }),
    animalGroups: async () => ({ items: [], meta: {} }),
    list: async () => ({ items: h.animals, meta: { hasNextPage: h.hasNextPage } }),
  },
}));
vi.mock("../../hooks/use-health", () => ({
  useCreateHealthCasesBulk: () => ({ mutateAsync: h.mutateAsync, isPending: false }),
}));
vi.mock("../protocol-picker", () => ({
  ProtocolPicker: ({ caseIds }: { caseIds?: string[] }) => <div data-testid="protocol-picker">{(caseIds ?? []).join(",")}</div>,
}));

function renderSheet(onClose = vi.fn(), onModeChange = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
        <BulkReportSheet open onClose={onClose} mode="many" onModeChange={onModeChange} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { onClose, onModeChange };
}

async function pickAllBySearch() {
  fireEvent.click(screen.getByRole("tab", { name: "Search" }));
  fireEvent.click(await screen.findByRole("button", { name: "Select all 3" }));
}

describe("BulkReportSheet (RFE-139)", () => {
  beforeEach(() => {
    h.mutateAsync.mockReset();
    h.hasNextPage = false;
  });

  it("lists animals for the chosen method and selects them all at once", async () => {
    renderSheet();
    await pickAllBySearch();
    expect(screen.getByText("3 animals selected")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Report 3 animals" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByText("No animals selected")).toBeTruthy();
  });

  it("warns when more animals exist than are listed", async () => {
    h.hasNextPage = true;
    renderSheet();
    fireEvent.click(screen.getByRole("tab", { name: "Search" }));
    expect(await screen.findByText("Showing the first 100 — narrow the search to see the rest.")).toBeTruthy();
  });

  it("will not submit with no animals, and says why", async () => {
    renderSheet();
    fireEvent.click(screen.getByRole("radio", { name: "Mastitis" }));
    fireEvent.click(screen.getByRole("button", { name: "Report sickness" }));
    expect(await screen.findByText("Pick at least one animal.")).toBeTruthy();
    expect(h.mutateAsync).not.toHaveBeenCalled();
  });

  it("will not submit without a condition", async () => {
    renderSheet();
    await pickAllBySearch();
    fireEvent.click(screen.getByRole("button", { name: "Report 3 animals" }));
    await waitFor(() => expect(screen.getByText(en.health.reportSickness.conditionRequired)).toBeTruthy());
    expect(h.mutateAsync).not.toHaveBeenCalled();
  });

  it("sends one bulk request, then shows what was opened and who was skipped", async () => {
    h.mutateAsync.mockResolvedValue({
      createdCount: 2,
      skippedCount: 1,
      results: [
        { cattleId: "a1", status: "created", healthCaseId: "c1", caseCode: "HC-1" },
        { cattleId: "a2", status: "skipped", reason: "dup" },
        { cattleId: "a3", status: "created", healthCaseId: "c3", caseCode: "HC-3" },
      ],
    });
    renderSheet();
    await pickAllBySearch();
    fireEvent.click(screen.getByRole("radio", { name: "Mastitis" }));
    fireEvent.click(screen.getByRole("button", { name: "Report 3 animals" }));

    expect(await screen.findByText("2 cases opened for Mastitis")).toBeTruthy();
    expect(h.mutateAsync).toHaveBeenCalledTimes(1);
    expect(h.mutateAsync.mock.calls[0][0]).toMatchObject({
      cattleIds: ["a1", "a2", "a3"],
      condition: "MASTITIS",
      priority: "MEDIUM",
      careType: "CURATIVE",
    });
    expect(screen.getByText("1 animal was skipped — it already has an open case for this condition")).toBeTruthy();
    // tags: name when there is one, tag number otherwise
    expect(screen.getByText("Lokkhi")).toBeTruthy();
    expect(screen.getByText("Bina")).toBeTruthy();
    expect(screen.getAllByText("RKL-002").length).toBeGreaterThan(0);
  });

  it("offers one protocol for all the new cases (not the skipped one)", async () => {
    h.mutateAsync.mockResolvedValue({
      createdCount: 2,
      skippedCount: 1,
      results: [
        { cattleId: "a1", status: "created", healthCaseId: "c1", caseCode: "HC-1" },
        { cattleId: "a2", status: "skipped", reason: "dup" },
        { cattleId: "a3", status: "created", healthCaseId: "c3", caseCode: "HC-3" },
      ],
    });
    renderSheet();
    await pickAllBySearch();
    fireEvent.click(screen.getByRole("radio", { name: "Mastitis" }));
    fireEvent.click(screen.getByRole("button", { name: "Report 3 animals" }));
    fireEvent.click(await screen.findByRole("button", { name: /Start a protocol for the new cases/ }));
    expect(screen.getByTestId("protocol-picker").textContent).toBe("c1,c3");
  });

  it("closing the result calls onClose", async () => {
    h.mutateAsync.mockResolvedValue({ createdCount: 1, skippedCount: 0, results: [{ cattleId: "a1", status: "created", healthCaseId: "c1", caseCode: "HC-1" }] });
    const { onClose } = renderSheet();
    await pickAllBySearch();
    fireEvent.click(screen.getByRole("radio", { name: "Mastitis" }));
    fireEvent.click(screen.getByRole("button", { name: "Report 3 animals" }));
    fireEvent.click(await screen.findByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("the mode switch goes back to one animal", () => {
    const { onModeChange } = renderSheet();
    fireEvent.click(screen.getByRole("radio", { name: "One animal" }));
    expect(onModeChange).toHaveBeenCalledWith("one");
  });
});
