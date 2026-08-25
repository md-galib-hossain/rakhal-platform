import { describe, expect, it } from "vitest";
import { purchaseSummary } from "./ledger-purchases-table";
import type { Purchase, PurchaseLine } from "../types-v2";

function makeLine(overrides: Partial<PurchaseLine> = {}): PurchaseLine {
  return {
    id: "line-1",
    purchaseId: "purchase-1",
    medicineId: "medicine-1",
    feedItemId: null,
    equipmentId: null,
    quantity: "10.00",
    unitCost: "100.00",
    totalAmount: "1000.00",
    ...overrides,
  };
}

function makePurchase(lines: PurchaseLine[]): Purchase {
  return {
    id: "purchase-1",
    farmId: "farm-1",
    purchaseNumber: "PUR-000001",
    supplierId: null,
    purchaseDate: "2026-08-24T00:00:00.000Z",
    totalAmount: "1000.00",
    notes: null,
    createdById: "user-1",
    createdAt: "2026-08-24T00:00:00.000Z",
    lines,
  };
}

describe("purchaseSummary", () => {
  it("returns a dash for a purchase with no lines", () => {
    expect(purchaseSummary(makePurchase([]))).toBe("—");
  });

  it("returns the line count for a single-line purchase", () => {
    expect(purchaseSummary(makePurchase([makeLine()]))).toBe("1");
  });

  it("returns the line count for a multi-line purchase", () => {
    expect(purchaseSummary(makePurchase([makeLine({ id: "l1" }), makeLine({ id: "l2", medicineId: null, feedItemId: "feed-1" }), makeLine({ id: "l3", medicineId: null, equipmentId: "eq-1" })]))).toBe("3");
  });
});
