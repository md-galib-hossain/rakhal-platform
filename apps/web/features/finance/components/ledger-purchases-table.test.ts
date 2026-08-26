import { describe, expect, it } from "vitest";
import { purchaseSummary } from "./ledger-purchases-table";
import type { Purchase } from "../types-v2";

function makePurchase(lineCount: number): Purchase {
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
    _count: { lines: lineCount },
  };
}

describe("purchaseSummary", () => {
  it("returns a dash for a purchase with no lines", () => {
    expect(purchaseSummary(makePurchase(0))).toBe("—");
  });

  it("returns the line count for a single-line purchase", () => {
    expect(purchaseSummary(makePurchase(1))).toBe("1");
  });

  it("returns the line count for a multi-line purchase", () => {
    expect(purchaseSummary(makePurchase(3))).toBe("3");
  });
});
