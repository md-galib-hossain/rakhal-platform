import { Beef, Package } from "lucide-react";
import { describe, expect, it } from "vitest";
import { saleSummary } from "./ledger-sales-table";
import type { Sale, SaleLineSummary } from "../types-v2";

function makeLineSummary(overrides: Partial<SaleLineSummary> = {}): SaleLineSummary {
  return {
    type: "MILK",
    description: "Milk sale",
    quantity: 100,
    ...overrides,
  };
}

function makeSale(lineSummary: SaleLineSummary): Sale {
  return {
    id: "sale-1",
    saleNumber: "SALE-000001",
    saleDate: "2026-08-24T00:00:00.000Z",
    status: "CONFIRMED",
    customer: null,
    totalAmount: "5000.00",
    paidAmount: "0.00",
    dueAmount: "5000.00",
    paymentStatus: "UNPAID",
    dueDate: null,
    lineSummary,
  };
}

describe("saleSummary", () => {
  it("returns a dash when the sale has no lineSummary type", () => {
    const result = saleSummary(makeSale(makeLineSummary({ type: null, description: null })));
    expect(result.text).toBe("—");
    expect(result.icon).toBe(Package);
  });

  it("shows the lineSummary's own description", () => {
    const sale = makeSale(makeLineSummary({ description: "40L morning milk to Dhaka Dairy" }));
    expect(saleSummary(sale).text).toBe("40L morning milk to Dhaka Dairy");
  });

  it("uses the lineSummary's type to pick the icon", () => {
    const sale = makeSale(makeLineSummary({ type: "ANIMAL", description: "Sold a bull" }));
    expect(saleSummary(sale).icon).toBe(Beef);
  });
});
