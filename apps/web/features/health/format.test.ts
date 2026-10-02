import { describe, expect, it } from "vitest";
import { caseTitle } from "./format";

const label = (condition: string) => `label:${condition}`;

describe("caseTitle (RAKHAL-418: condition is primary, note optional)", () => {
  it("shows the condition's label when there is one", () => {
    expect(caseTitle({ condition: "MASTITIS", note: "left hind quarter" }, label)).toBe("label:MASTITIS");
  });

  it("falls back to the note when no condition was captured", () => {
    expect(caseTitle({ condition: null, note: "Mild lameness at purchase" }, label)).toBe("Mild lameness at purchase");
  });

  it("never renders blank or 'undefined' — a case with neither shows a dash", () => {
    expect(caseTitle({ condition: null, note: null }, label)).toBe("—");
  });
});
