import { describe, expect, it } from "vitest";
import { resolveSection } from "./section-state";

describe("resolveSection", () => {
  it("defaults to the timeline", () => {
    expect(resolveSection(null, null, true)).toBe("timeline");
  });
  it("uses ?section= when valid", () => {
    expect(resolveSection("family", null, false)).toBe("family");
    expect(resolveSection("bogus", null, false)).toBe("timeline");
  });
  it("maps legacy ?tab= links", () => {
    expect(resolveSection(null, "feeding", false)).toBe("feeding");
    expect(resolveSection(null, "pedigree", false)).toBe("family");
    expect(resolveSection(null, "reproduction", false)).toBe("timeline");
    expect(resolveSection(null, "finance", true)).toBe("money");
  });
  it("prefers section over the legacy tab", () => {
    expect(resolveSection("family", "feeding", false)).toBe("family");
  });
  it("hides Money without finance permission", () => {
    expect(resolveSection("money", null, false)).toBe("timeline");
    expect(resolveSection(null, "finance", false)).toBe("timeline");
    expect(resolveSection("money", null, true)).toBe("money");
  });
});
