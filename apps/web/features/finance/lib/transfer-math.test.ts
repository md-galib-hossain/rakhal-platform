import { describe, expect, it } from "vitest";
import { computeTransferTotal } from "./transfer-math";

describe("computeTransferTotal", () => {
  it("sums amount and fee into totalDebited", () => {
    expect(computeTransferTotal(1000, 20)).toEqual({ amount: 1000, fee: 20, totalDebited: 1020 });
  });

  it("treats a missing fee as zero", () => {
    expect(computeTransferTotal(500, undefined)).toEqual({ amount: 500, fee: 0, totalDebited: 500 });
  });

  it("treats a missing amount as zero", () => {
    expect(computeTransferTotal(undefined, 20)).toEqual({ amount: 0, fee: 0, totalDebited: 0 });
  });

  it("treats both missing as zero", () => {
    expect(computeTransferTotal(undefined, undefined)).toEqual({ amount: 0, fee: 0, totalDebited: 0 });
  });

  it("ignores a zero or negative amount (never a real transfer)", () => {
    expect(computeTransferTotal(0, 10)).toEqual({ amount: 0, fee: 0, totalDebited: 0 });
    expect(computeTransferTotal(-50, 10)).toEqual({ amount: 0, fee: 0, totalDebited: 0 });
  });

  it("ignores a negative fee", () => {
    expect(computeTransferTotal(1000, -5)).toEqual({ amount: 1000, fee: 0, totalDebited: 1000 });
  });

  it("handles decimal paisa-free taka amounts", () => {
    expect(computeTransferTotal(1250.5, 10.25)).toEqual({ amount: 1250.5, fee: 10.25, totalDebited: 1260.75 });
  });
});
