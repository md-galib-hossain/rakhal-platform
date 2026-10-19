import { describe, expect, it } from "vitest";
import { sellMilkSchema } from "./schemas";

const base = {
  buyerId: "b1",
  volumeL: 40,
  saleDate: "2026-10-19",
  settlement: "PAID_NOW" as const,
  amountReceived: 2800,
  paymentMethod: "CASH" as const,
};

describe("sellMilkSchema", () => {
  it("accepts a paid-now sale with an amount and a method", () => {
    expect(sellMilkSchema.safeParse(base).success).toBe(true);
  });

  it("accepts a credit sale with no amount", () => {
    const result = sellMilkSchema.safeParse({ ...base, settlement: "ON_CREDIT", amountReceived: undefined });
    expect(result.success).toBe(true);
  });

  it("rejects a paid-now sale with no amount received", () => {
    const result = sellMilkSchema.safeParse({ ...base, amountReceived: undefined });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(["amountReceived"]);
  });

  it("rejects a paid-now sale with a zero amount", () => {
    expect(sellMilkSchema.safeParse({ ...base, amountReceived: 0 }).success).toBe(false);
  });

  it("rejects a missing buyer and non-positive litres", () => {
    expect(sellMilkSchema.safeParse({ ...base, buyerId: "" }).success).toBe(false);
    expect(sellMilkSchema.safeParse({ ...base, volumeL: 0 }).success).toBe(false);
    expect(sellMilkSchema.safeParse({ ...base, volumeL: -5 }).success).toBe(false);
  });

  it("rejects a payment method the backend does not know", () => {
    expect(sellMilkSchema.safeParse({ ...base, paymentMethod: "WALLET" }).success).toBe(false);
  });
});
