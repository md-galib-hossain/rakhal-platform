import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/i18n/messages/en.json";
import { TreatmentHistoryTable } from "./treatment-history-table";
import type { TreatmentLogListItem } from "../types";

const mockVoidMutate = vi.fn().mockResolvedValue({ id: "log-1", voided: true });

vi.mock("../hooks/use-health", () => ({
  useVoidTreatment: () => ({
    mutateAsync: mockVoidMutate,
    isPending: false,
  }),
}));

vi.mock("@/lib/auth/permissions", () => ({
  useCan: () => (perm: string) => perm === "healthcare.update",
}));

vi.mock("@/components/shared/animal-link", () => ({
  AnimalLink: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/shared/row-actions-menu", () => ({
  RowActionsMenu: ({ actions }: { actions: { label: string; onSelect: () => void }[] }) => (
    <div>
      {actions.map((a) => (
        <button key={a.label} type="button" onClick={a.onSelect}>
          {a.label}
        </button>
      ))}
    </div>
  ),
}));

const mockItems: TreatmentLogListItem[] = [
  {
    id: "log-1",
    farmId: "farm-1",
    cattleId: "cow-1",
    medicineName: "Amoxicillin",
    doseAmount: 10,
    doseUnit: "ml",
    route: "IM",
    administeredAt: "2026-10-27T10:00:00.000Z",
    administeredBy: "Dr. Selim",
    notes: "Follow up injection",
    cattle: {
      id: "cow-1",
      name: "Lokkhi",
      tagNumber: "TAG-001",
      image: null,
    },
    healthCase: {
      id: "case-1",
      caseCode: "HC-001",
      careType: "CURATIVE",
      condition: "MASTITIS",
    },
  },
  {
    id: "log-2",
    farmId: "farm-1",
    cattleId: "cow-2",
    medicineName: "FMD Vaccine",
    doseAmount: 5,
    doseUnit: "ml",
    route: "SC",
    administeredAt: "2026-10-27T11:00:00.000Z",
    administeredBy: "Worker Kashem",
    notes: "Annual vaccine",
    cattle: {
      id: "cow-2",
      name: "Shundori",
      tagNumber: "TAG-002",
      image: null,
    },
    healthCase: {
      id: "case-2",
      caseCode: "HC-002",
      careType: "PREVENTIVE",
    },
  },
];

function renderTable(items = mockItems) {
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
      <TreatmentHistoryTable items={items} isLoading={false} isError={false} onRetry={vi.fn()} />
    </NextIntlClientProvider>,
  );
}

describe("TreatmentHistoryTable", () => {
  it("renders treatment log entries with animal, purpose, medicine, and dose", () => {
    renderTable();
    expect(screen.getAllByText("Lokkhi").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Shundori").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Amoxicillin").length).toBeGreaterThan(0);
    expect(screen.getAllByText("FMD Vaccine").length).toBeGreaterThan(0);
    expect(screen.getAllByText("10 ml").length).toBeGreaterThan(0);
    expect(screen.getAllByText("5 ml").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Illness")).toHaveLength(2); // desktop + mobile
    expect(screen.getAllByText("Wellness / Vaccine")).toHaveLength(2); // desktop + mobile
  });

  it("opens confirmation dialog when void action is clicked and calls voidTreatment on confirm", async () => {
    renderTable();
    const voidOptions = screen.getAllByRole("button", { name: "Cancel entry (Void)" });
    expect(voidOptions.length).toBeGreaterThan(0);

    // Click the first void action
    fireEvent.click(voidOptions[0]);

    // Confirmation dialog should appear
    expect(screen.getByText("Cancel this treatment record?")).toBeTruthy();

    // Click confirm
    const confirmButton = screen.getByRole("button", { name: "Cancel Record" });
    fireEvent.click(confirmButton);

    expect(mockVoidMutate).toHaveBeenCalledWith({ id: "log-1" });
  });

  it("renders empty state when there are no logs", () => {
    renderTable([]);
    expect(screen.getByText("No treatment logs found")).toBeTruthy();
  });
});
