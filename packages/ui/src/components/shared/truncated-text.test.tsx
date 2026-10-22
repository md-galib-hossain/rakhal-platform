import { describe, expect, it } from "vitest";
import { isTextClipped } from "./truncated-text";

function el(box: { scrollWidth: number; clientWidth: number; scrollHeight?: number; clientHeight?: number }) {
  return { scrollHeight: 20, clientHeight: 20, ...box } as unknown as HTMLElement;
}

describe("isTextClipped", () => {
  it("is false when the text fits", () => {
    expect(isTextClipped(el({ scrollWidth: 100, clientWidth: 100 }))).toBe(false);
  });
  it("ignores a 1px sub-pixel rounding gap", () => {
    expect(isTextClipped(el({ scrollWidth: 101, clientWidth: 100 }))).toBe(false);
  });
  it("is true when wider than the box", () => {
    expect(isTextClipped(el({ scrollWidth: 180, clientWidth: 100 }))).toBe(true);
  });
  it("is true for a line-clamped block taller than its box", () => {
    expect(isTextClipped(el({ scrollWidth: 100, clientWidth: 100, scrollHeight: 60, clientHeight: 40 }))).toBe(true);
  });
});
