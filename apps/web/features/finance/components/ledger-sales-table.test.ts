import { Beef, Package } from "lucide-react";
import { describe, expect, it } from "vitest";
import { saleSummary } from "./ledger-sales-table";
import type { Sale, SaleLine } from "../types-v2";

function makeLine(overrides: Partial<SaleLine> = {}): SaleLine {
  return {
    id: "line-1",
    saleId: "sale-1",
    type: "MILK",
    description: "Milk sale",
    quantity: "100.00",
    unitId: null,
    unit: null,
    unitPrice: "50.00",
    totalAmount: "5000.00",
    milkDetail: { id: "milk-1" },
    animalDetail: null,
    inventoryDetail: null,
    manureDetail: null,
    ...overrides,
  };
}

function makeSale(lines: SaleLine[]): Sale {
  return {
    id: "sale-1",
    farmId: "farm-1",
    saleNumber: "SALE-000001",
    customerId: null,
    saleDate: "2026-08-24T00:00:00.000Z",
    subtotal: "5000.00",
    discountAmount: "0.00",
    totalAmount: "5000.00",
    status: "CONFIRMED",
    notes: null,
    createdById: "user-1",
    createdAt: "2026-08-24T00:00:00.000Z",
    lines,
  };
}

describe("saleSummary", () => {
  it("returns a dash for a sale with no lines", () => {
    const result = saleSummary(makeSale([]));
    expect(result.text).toBe("—");
    expect(result.icon).toBe(Package);
  });

  it("shows the single line's own description for a one-line sale", () => {
    const sale = makeSale([makeLine({ description: "40L morning milk to Dhaka Dairy" })]);
    expect(saleSummary(sale).text).toBe("40L morning milk to Dhaka Dairy");
  });

  it("joins up to 2 line descriptions for a multi-line sale with no overflow", () => {
    const sale = makeSale([
      makeLine({ id: "l1", description: "Milk" }),
      makeLine({ id: "l2", type: "MANURE", description: "Manure", manureDetail: { id: "m1", notes: null }, milkDetail: null }),
    ]);
    expect(saleSummary(sale).text).toBe("Milk, Manure");
  });

  it("caps at 2 lines and appends a +N tail for larger sales", () => {
    const sale = makeSale([
      makeLine({ id: "l1", description: "Milk" }),
      makeLine({ id: "l2", type: "MANURE", description: "Manure", manureDetail: { id: "m1", notes: null }, milkDetail: null }),
      makeLine({ id: "l3", type: "INVENTORY", description: "Feed bag", inventoryDetail: { id: "i1", medicineId: null, feedItemId: "f1", equipmentId: null }, milkDetail: null }),
    ]);
    expect(saleSummary(sale).text).toBe("Milk, Manure +1");
  });

  it("uses the first line's type to pick the icon", () => {
    const sale = makeSale([makeLine({ type: "ANIMAL", description: "Sold a bull", animalDetail: { id: "a1", cattleId: "c1" }, milkDetail: null })]);
    expect(saleSummary(sale).icon).toBe(Beef);
  });
});
