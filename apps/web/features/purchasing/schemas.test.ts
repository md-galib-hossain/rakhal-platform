import { describe, expect, it } from "vitest";
import { computePurchaseOutstanding, computePurchaseTotal, newItemDraftSchema, purchaseFormSchema, purchasePaidAmount } from "./schemas";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LEDGER_CODE } from "./types";

/**
 * RAKHAL-359 — real logic tests, not snapshots, per this ticket's own AC ("Vitest for the
 * purchase-total derivation and expense-category-to-ledger mapping display logic").
 */

describe("computePurchaseTotal", () => {
  it("sums quantity * unitCost across lines", () => {
    expect(
      computePurchaseTotal([
        { quantity: 10, unitCost: 50 },
        { quantity: 2, unitCost: 100 },
      ]),
    ).toBe(700);
  });

  it("matches the backend's own worked AC example — ৳30,000 feed purchase", () => {
    // `FINANCE_V2_DESIGN.md` §5.1 / `CreatePurchaseDto`'s own doc comment: "৳30,000 feed purchase,
    // ৳20,000 paid from Bank → Payable 10,000, inventory +quantity".
    expect(computePurchaseTotal([{ quantity: 300, unitCost: 100 }])).toBe(30000);
  });

  it("returns 0 for an empty line list", () => {
    expect(computePurchaseTotal([])).toBe(0);
  });

  it("rounds to 2 decimal places, avoiding float drift", () => {
    expect(computePurchaseTotal([{ quantity: 3, unitCost: 0.1 }])).toBe(0.3);
  });

  it("handles a single line with a fractional quantity", () => {
    expect(computePurchaseTotal([{ quantity: 2.5, unitCost: 40 }])).toBe(100);
  });
});

describe("computePurchaseOutstanding", () => {
  it("matches the backend's own worked AC example — ৳20,000 paid leaves ৳10,000 outstanding", () => {
    expect(computePurchaseOutstanding(30000, 20000)).toBe(10000);
  });

  it("returns 0 when paid in full", () => {
    expect(computePurchaseOutstanding(30000, 30000)).toBe(0);
  });

  it("returns the full total when nothing is paid", () => {
    expect(computePurchaseOutstanding(30000, 0)).toBe(30000);
  });

  it("never goes negative even if paidAmount is (incorrectly) larger than the total", () => {
    expect(computePurchaseOutstanding(100, 150)).toBe(0);
  });
});

describe("EXPENSE_CATEGORY_LEDGER_CODE", () => {
  it("maps every one of the 5 closed ExpenseCategory values to a seeded 5xxx ledger code", () => {
    for (const category of EXPENSE_CATEGORIES) {
      expect(EXPENSE_CATEGORY_LEDGER_CODE[category]).toMatch(/^5\d{3}$/);
    }
  });

  it("has exactly 5 categories — deliberately no OTHER (RD-060, no ledger account exists for one)", () => {
    expect(EXPENSE_CATEGORIES).toHaveLength(5);
    expect(EXPENSE_CATEGORIES).not.toContain("OTHER");
  });

  it("matches the backend's exact EXPENSE_CATEGORY_LEDGER_CODE mapping (expense.service.ts)", () => {
    expect(EXPENSE_CATEGORY_LEDGER_CODE).toEqual({
      SALARY: "5200",
      UTILITIES: "5400",
      BREEDING: "5300",
      TRANSFER_FEE: "5500",
      DEPRECIATION: "5600",
    });
  });
});

describe("purchasePaidAmount", () => {
  it("pays the whole total for FULL, nothing for CREDIT", () => {
    expect(purchasePaidAmount("FULL", 700, undefined)).toBe(700);
    expect(purchasePaidAmount("CREDIT", 700, 300)).toBe(0);
  });

  it("uses the typed amount for PART, clamped between 0 and the total", () => {
    expect(purchasePaidAmount("PART", 700, 300)).toBe(300);
    expect(purchasePaidAmount("PART", 700, 900)).toBe(700);
    expect(purchasePaidAmount("PART", 700, undefined)).toBe(0);
  });
});

describe("purchaseFormSchema", () => {
  const medicineLine = { itemKind: "MEDICINE" as const, itemId: "med-1", itemName: "Oxytetracycline", quantity: 2, unitCost: 100, expiryDate: "2027-01-31" };
  const base = { supplierId: "sup-1", purchaseDate: "2026-10-19", lines: [medicineLine], paymentMode: "FULL" as const };

  it("accepts pay-in-full with nothing else typed", () => {
    expect(purchaseFormSchema.safeParse(base).success).toBe(true);
  });

  it("needs an item: either an existing id or a typed new item", () => {
    const result = purchaseFormSchema.safeParse({ ...base, lines: [{ ...medicineLine, itemId: "" }] });
    expect(result.success).toBe(false);
    const withNew = purchaseFormSchema.safeParse({
      ...base,
      lines: [{ ...medicineLine, itemId: "", newItem: { kind: "MEDICINE", name: "Ivermectin", unitId: "u1", medicineType: "LIQUID", medicineCategory: "ANTIPARASITIC" } }],
    });
    expect(withNew.success).toBe(true);
  });

  it("requires an expiry date on a medicine line but not on feed", () => {
    expect(purchaseFormSchema.safeParse({ ...base, lines: [{ ...medicineLine, expiryDate: undefined }] }).success).toBe(false);
    const feed = { itemKind: "FEED_ITEM" as const, itemId: "f1", itemName: "Maize", quantity: 10, unitCost: 50 };
    expect(purchaseFormSchema.safeParse({ ...base, lines: [feed] }).success).toBe(true);
  });

  it("PART needs an amount above 0 and below the total", () => {
    expect(purchaseFormSchema.safeParse({ ...base, paymentMode: "PART" }).success).toBe(false);
    expect(purchaseFormSchema.safeParse({ ...base, paymentMode: "PART", paidAmount: 50 }).success).toBe(true);
    // total is 2 x 100 = 200 — paying all of it is "Pay in full", not "Part paid"
    expect(purchaseFormSchema.safeParse({ ...base, paymentMode: "PART", paidAmount: 200 }).success).toBe(false);
  });

  it("CREDIT needs no amount", () => {
    expect(purchaseFormSchema.safeParse({ ...base, paymentMode: "CREDIT" }).success).toBe(true);
  });
});

describe("newItemDraftSchema", () => {
  it("medicine needs a unit, a form and a category", () => {
    expect(newItemDraftSchema.safeParse({ kind: "MEDICINE", name: "X" }).success).toBe(false);
    expect(newItemDraftSchema.safeParse({ kind: "MEDICINE", name: "X", unitId: "u", medicineType: "TABLET", medicineCategory: "VITAMIN" }).success).toBe(true);
  });

  it("feed needs a unit and a catalogue ingredient with its class", () => {
    expect(newItemDraftSchema.safeParse({ kind: "FEED", name: "X", unitId: "u" }).success).toBe(false);
    expect(newItemDraftSchema.safeParse({ kind: "FEED", name: "X", unitId: "u", ingredientId: "i", feedClass: "FORAGE" }).success).toBe(true);
  });

  it("equipment needs only a name", () => {
    expect(newItemDraftSchema.safeParse({ kind: "EQUIPMENT", name: "Bucket" }).success).toBe(true);
    expect(newItemDraftSchema.safeParse({ kind: "EQUIPMENT", name: "  " }).success).toBe(false);
  });
});
