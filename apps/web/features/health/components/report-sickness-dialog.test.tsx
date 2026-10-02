import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import { ReportSicknessDialog } from "./report-sickness-dialog";

// Radix's checkbox measures itself with ResizeObserver, which jsdom does not have.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const h = vi.hoisted(() => ({
  createCase: vi.fn(),
  createBulk: vi.fn(),
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
    findOne: async () => ({ id: "a1", tagNumber: "RKL-001", shed: { name: "Shed A" } }),
  },
}));
vi.mock("../hooks/use-health", () => ({
  useCreateHealthCase: () => ({ mutateAsync: h.createCase, isPending: false }),
  useCreateHealthCasesBulk: () => ({ mutateAsync: h.createBulk, isPending: false }),
  useOpenCasesForCattle: () => ({ data: { items: [] } }),
}));
vi.mock("./protocol-picker", () => ({
  ProtocolPicker: ({ caseIds }: { caseIds?: string[] }) => <div data-testid="protocol-picker">{(caseIds ?? []).join(",")}</div>,
}));
vi.mock("./report-sickness/next-step-card", () => ({
  NextStepCard: ({ animalName }: { animalName: string }) => <div data-testid="next-step">{animalName}</div>,
}));

function renderDialog(onOpenChange = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
        <ReportSicknessDialog open onOpenChange={onOpenChange} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

/** The picker opens on Individual, so the animals are listed straight away. Clicking a checked animal unticks it. */
async function pick(...labels: string[]) {
  for (const label of labels) {
    fireEvent.click(await screen.findByRole("checkbox", { name: new RegExp(label) }));
  }
}

describe("ReportSicknessDialog — one picker for one or many animals", () => {
  beforeEach(() => {
    h.createCase.mockReset();
    h.createBulk.mockReset();
    h.hasNextPage = false;
  });

  it("has no one/several switch, and opens on Search so a single cow is found by tag", async () => {
    renderDialog();
    expect(screen.queryByRole("radio", { name: "Several animals" })).toBeNull();
    expect(await screen.findByRole("tab", { name: "Individual", selected: true })).toBeTruthy();
  });

  it("has the same three methods as Quick Treat — Shed, Animal group, Individual — and no Search tab", async () => {
    renderDialog();
    expect(await screen.findByRole("tab", { name: "Shed" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Animal group" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Search" })).toBeNull();
  });

  it("the Shed tab uses the creatable select, so \"Create new shed\" lives inside the dropdown (same as Add animal)", async () => {
    renderDialog();
    fireEvent.click(await screen.findByRole("tab", { name: "Shed" }));
    expect(await screen.findByRole("combobox", { name: "Shed" })).toBeTruthy();
    expect(screen.queryByText("No sheds yet.")).toBeNull();
  });

  it("one animal → the single-case form (vitals + protocol button), saved as one case", async () => {
    h.createCase.mockResolvedValue({ id: "c1" });
    renderDialog();
    await pick("Lokkhi");
    expect(screen.getByText(en.health.reportSickness.temperature)).toBeTruthy();
    expect(screen.getByRole("button", { name: en.health.reportSickness.submitAndProtocol })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Mastitis" }));
    fireEvent.click(screen.getByRole("button", { name: en.health.reportSickness.submit }));

    expect(await screen.findByTestId("next-step")).toBeTruthy();
    expect(h.createCase).toHaveBeenCalledTimes(1);
    expect(h.createCase.mock.calls[0][0]).toMatchObject({ cattleId: "a1", condition: "MASTITIS", careType: "CURATIVE" });
    expect(h.createBulk).not.toHaveBeenCalled();
  });

  it("two or more animals → shared fields only: vitals and the protocol button go away, the count is on the submit", async () => {
    renderDialog();
    await pick("Lokkhi", "RKL-002");
    expect(screen.queryByText(en.health.reportSickness.temperature)).toBeNull();
    expect(screen.queryByRole("button", { name: en.health.reportSickness.submitAndProtocol })).toBeNull();
    expect(screen.getByText(en.health.reportSickness.bulk.vitalsHint)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Report 2 animals" })).toBeTruthy();
  });

  it("going from 2 animals back to 1 brings the single form back", async () => {
    renderDialog();
    await pick("Lokkhi", "RKL-002");
    expect(screen.queryByText(en.health.reportSickness.temperature)).toBeNull();
    await pick("RKL-002");
    expect(screen.getByText(en.health.reportSickness.temperature)).toBeTruthy();
  });

  it("will not submit with no animals, and says why", async () => {
    renderDialog();
    fireEvent.click(screen.getByRole("radio", { name: "Mastitis" }));
    fireEvent.click(screen.getByRole("button", { name: en.health.reportSickness.submit }));
    expect(await screen.findByText(en.health.reportSickness.cattleRequired)).toBeTruthy();
    expect(h.createCase).not.toHaveBeenCalled();
    expect(h.createBulk).not.toHaveBeenCalled();
  });

  it("will not submit several animals without a condition", async () => {
    renderDialog();
    await pick("Lokkhi", "RKL-002", "Bina");
    fireEvent.click(screen.getByRole("button", { name: "Report 3 animals" }));
    await waitFor(() => expect(screen.getByText(en.health.reportSickness.conditionRequired)).toBeTruthy());
    expect(h.createBulk).not.toHaveBeenCalled();
  });

  it("several animals → one bulk request, then what was opened and who was skipped", async () => {
    h.createBulk.mockResolvedValue({
      createdCount: 2,
      skippedCount: 1,
      results: [
        { cattleId: "a1", status: "created", healthCaseId: "c1", caseCode: "HC-1" },
        { cattleId: "a2", status: "skipped", reason: "dup" },
        { cattleId: "a3", status: "created", healthCaseId: "c3", caseCode: "HC-3" },
      ],
    });
    renderDialog();
    await pick("Lokkhi", "RKL-002", "Bina");
    fireEvent.click(screen.getByRole("radio", { name: "Mastitis" }));
    fireEvent.click(screen.getByRole("button", { name: "Report 3 animals" }));

    expect(await screen.findByText("2 cases opened for Mastitis")).toBeTruthy();
    expect(h.createBulk).toHaveBeenCalledTimes(1);
    expect(h.createBulk.mock.calls[0][0]).toMatchObject({ cattleIds: ["a1", "a2", "a3"], condition: "MASTITIS", priority: "MEDIUM", careType: "CURATIVE" });
    expect(h.createCase).not.toHaveBeenCalled();
    expect(screen.getByText("1 animal was skipped — it already has an open case for this condition")).toBeTruthy();
    // tags: name when there is one, tag number otherwise
    expect(screen.getByText("Lokkhi")).toBeTruthy();
    expect(screen.getByText("Bina")).toBeTruthy();
    expect(screen.getAllByText("RKL-002").length).toBeGreaterThan(0);
  });

  it("offers one protocol for all the new cases (not the skipped one)", async () => {
    h.createBulk.mockResolvedValue({
      createdCount: 2,
      skippedCount: 1,
      results: [
        { cattleId: "a1", status: "created", healthCaseId: "c1", caseCode: "HC-1" },
        { cattleId: "a2", status: "skipped", reason: "dup" },
        { cattleId: "a3", status: "created", healthCaseId: "c3", caseCode: "HC-3" },
      ],
    });
    renderDialog();
    await pick("Lokkhi", "RKL-002", "Bina");
    fireEvent.click(screen.getByRole("radio", { name: "Mastitis" }));
    fireEvent.click(screen.getByRole("button", { name: "Report 3 animals" }));
    fireEvent.click(await screen.findByRole("button", { name: /Start a protocol for the new cases/ }));
    expect(screen.getByTestId("protocol-picker").textContent).toBe("c1,c3");
  });

  it("closing the bulk result closes the dialog", async () => {
    h.createBulk.mockResolvedValue({ createdCount: 2, skippedCount: 0, results: [{ cattleId: "a1", status: "created", healthCaseId: "c1", caseCode: "HC-1" }] });
    const { onOpenChange } = renderDialog();
    await pick("Lokkhi", "RKL-002");
    fireEvent.click(screen.getByRole("radio", { name: "Mastitis" }));
    fireEvent.click(screen.getByRole("button", { name: "Report 2 animals" }));
    fireEvent.click(await screen.findByRole("button", { name: "Done" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
