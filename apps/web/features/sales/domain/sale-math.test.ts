import { describe, expect, it } from "vitest";
import {
  clampAmountReceived,
  computeDue,
  computeLineTotal,
  computeSaleTotal,
  derivePaymentStatus,
} from "./sale-math";

describe("computeLineTotal", () => {
  it("multiplies quantity by unit price", () => {
    expect(computeLineTotal(10, 55.5)).toBe(555);
  });

  it("treats missing quantity/price as 0", () => {
    expect(computeLineTotal(undefined, 55.5)).toBe(0);
    expect(computeLineTotal(10, undefined)).toBe(0);
    expect(computeLineTotal(undefined, undefined)).toBe(0);
  });

  it("rounds to 2 decimals", () => {
    expect(computeLineTotal(3, 0.1)).toBe(0.3);
    expect(computeLineTotal(1.005, 100)).toBe(100.5);
  });
});

describe("computeSaleTotal", () => {
  it("sums multiple lines", () => {
    const total = computeSaleTotal([
      { quantity: 10, unitPrice: 50 },
      { quantity: 2, unitPrice: 25 },
    ]);
    expect(total).toBe(550);
  });

  it("returns 0 for an empty line list", () => {
    expect(computeSaleTotal([])).toBe(0);
  });
});

describe("computeDue", () => {
  it("is the full total when nothing has been received", () => {
    expect(computeDue(1000, undefined)).toBe(1000);
    expect(computeDue(1000, 0)).toBe(1000);
  });

  it("subtracts amount received", () => {
    expect(computeDue(1000, 400)).toBe(600);
  });

  it("clamps to 0 when fully paid or over-paid", () => {
    expect(computeDue(1000, 1000)).toBe(0);
    expect(computeDue(1000, 1500)).toBe(0);
  });

  it("never returns a negative number for a 0 total", () => {
    expect(computeDue(0, 0)).toBe(0);
  });
});

describe("derivePaymentStatus", () => {
  it("is UNPAID at 0 received", () => {
    expect(derivePaymentStatus(1000, undefined)).toBe("UNPAID");
    expect(derivePaymentStatus(1000, 0)).toBe("UNPAID");
  });

  it("is PARTIALLY_PAID for 0 < received < total", () => {
    expect(derivePaymentStatus(1000, 1)).toBe("PARTIALLY_PAID");
    expect(derivePaymentStatus(1000, 999)).toBe("PARTIALLY_PAID");
  });

  it("is PAID at exactly total or above", () => {
    expect(derivePaymentStatus(1000, 1000)).toBe("PAID");
    expect(derivePaymentStatus(1000, 1200)).toBe("PAID");
  });

  it("treats a 0 sale total as PAID once anything is entered, UNPAID otherwise", () => {
    expect(derivePaymentStatus(0, 0)).toBe("UNPAID");
    expect(derivePaymentStatus(0, 1)).toBe("PAID");
  });
});

describe("clampAmountReceived", () => {
  it("passes undefined through unchanged", () => {
    expect(clampAmountReceived(undefined, 1000)).toBeUndefined();
  });

  it("clamps to the sale total on overpayment", () => {
    expect(clampAmountReceived(1500, 1000)).toBe(1000);
  });

  it("clamps negative input to 0", () => {
    expect(clampAmountReceived(-50, 1000)).toBe(0);
  });

  it("passes an in-range value through untouched", () => {
    expect(clampAmountReceived(400, 1000)).toBe(400);
  });
});
