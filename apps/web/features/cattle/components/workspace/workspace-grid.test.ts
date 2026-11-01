import { describe, expect, it } from "vitest";
import { WS_BREAKPOINTS, WS_GRID, WS_GRID_DRILL, workspaceColumns } from "./workspace-grid";

describe("workspace grid (RFE-176)", () => {
  it("shows 1, 2 and 3 columns at 600, 1000 and 1240px of container width", () => {
    expect(workspaceColumns(600)).toBe(1);
    expect(workspaceColumns(1000)).toBe(2);
    expect(workspaceColumns(1240)).toBe(3);
  });

  it("switches exactly at 720 and 1080 (the drill panel uses the same width)", () => {
    expect(workspaceColumns(719)).toBe(1);
    expect(workspaceColumns(720)).toBe(2);
    expect(workspaceColumns(1079)).toBe(2);
    expect(workspaceColumns(1080)).toBe(3);
    expect(workspaceColumns(1079, true)).toBe(2);
    expect(workspaceColumns(1080, true)).toBe(3);
  });

  it("keeps every column at its minimum when it shows 3 columns", () => {
    // rail 260 + centre 480 + right 300 + two 24px gaps (the 3-column gap) must fit in the 3-column breakpoint
    expect(260 + 480 + 300 + 2 * 24).toBeLessThanOrEqual(WS_BREAKPOINTS.three + 8);
    expect(WS_GRID).toContain("minmax(260px,300px)_minmax(480px,1fr)_minmax(300px,340px)");
  });

  it("uses container variants at the same widths, never viewport breakpoints", () => {
    expect(WS_GRID).toContain(`@min-[${WS_BREAKPOINTS.two}px]/ws:grid-cols-`);
    expect(WS_GRID).toContain(`@min-[${WS_BREAKPOINTS.three}px]/ws:grid-cols-`);
    expect(WS_GRID_DRILL).toContain(`@min-[${WS_BREAKPOINTS.drillWide}px]/ws:grid-cols-`);
    for (const cls of [WS_GRID, WS_GRID_DRILL]) expect(cls).not.toMatch(/(^|\s)(sm|md|lg|xl):/);
  });
});
