/**
 * Workspace body grid (RFE-176, 06 §3; retuned for the content-sized shell in RFE-185). Every rule keys off the body's OWN width (Tailwind v4 container queries on
 * `@container/ws`), never the viewport: the shell is at most 1280px wide (`WS_SHELL`), so viewport breakpoints are wrong.
 * 1 column under 720px, 2 from 720px (rail | main, Next up on top of main), 3 from 1080px, the width at which every
 * track keeps its minimum (rail 260 + centre 480 + right 300 + two 20px gaps). A drill panel replaces the main column
 * and takes the Next-up track too from the same width.
 * Shared with the skeleton so loading matches the loaded layout. Class strings stay literal so Tailwind sees them.
 */
export const WS_BREAKPOINTS = { two: 720, three: 1080, drillWide: 1080 } as const;

/** Max body width: matches the shell's 1280px minus its 2 x 20px padding, so no column stretches into empty space. */
export const WS_MAX = 1240;

/**
 * The shell (RFE-185): a right-anchored sheet, `min(100vw - 20px, 1120px)` wide (RFE-186) from 640px, full screen below. The
 * Feed Formulator geometry (whole content area) left a wide dead band on desktop. Padding is fluid (clamp).
 */
export const WS_SHELL =
  "inset-0 flex h-dvh w-auto max-w-none flex-col gap-0 rounded-none border-0 p-4 pb-0 shadow-2xl sm:inset-y-2.5 sm:left-auto sm:right-2.5 sm:h-[calc(100dvh-20px)] sm:w-[min(calc(100vw-20px),1120px)] sm:max-w-none sm:rounded-[20px] sm:border-2 sm:border-border sm:p-[clamp(16px,2vw,20px)] sm:pb-[clamp(16px,2vw,20px)]";

/** Container root: gives the `@min-[…]/ws:` variants their reference width. No `fixed` descendants (containment re-anchors them). */
export const WS_CONTAINER = "@container/ws min-w-0 overflow-x-clip";

/** Timeline-section scroller: the whole body scrolls under 720px, each column scrolls on its own from 720px. */
export const WS_SCROLLER = "h-full min-h-0 overflow-y-auto overflow-x-clip @min-[720px]/ws:overflow-hidden";

const GRID_BASE =
  "mx-auto grid w-full max-w-[1240px] grid-cols-[minmax(0,1fr)] gap-4 @min-[720px]/ws:h-full @min-[1080px]/ws:gap-6";

export const WS_GRID = `${GRID_BASE} @min-[720px]/ws:grid-cols-[minmax(240px,300px)_minmax(0,1fr)] @min-[720px]/ws:grid-rows-[auto_minmax(0,1fr)] @min-[720px]/ws:[grid-template-areas:'rail_next'_'rail_time'] @min-[1080px]/ws:grid-cols-[minmax(260px,300px)_minmax(480px,1fr)_minmax(300px,340px)] @min-[1080px]/ws:grid-rows-[minmax(0,1fr)] @min-[1080px]/ws:[grid-template-areas:'rail_time_next']`;

export const WS_GRID_DRILL = `${GRID_BASE} @min-[720px]/ws:grid-cols-[minmax(240px,300px)_minmax(0,1fr)] @min-[720px]/ws:grid-rows-[minmax(0,1fr)] @min-[720px]/ws:[grid-template-areas:'rail_time'] @min-[1080px]/ws:grid-cols-[minmax(260px,300px)_minmax(480px,1fr)_minmax(300px,340px)] @min-[1080px]/ws:[grid-template-areas:'rail_time_time']`;

const COLUMN = "@min-[720px]/ws:min-h-0 @min-[720px]/ws:overflow-y-auto";
export const WS_AREA_NEXT = `min-w-0 @min-[720px]/ws:[grid-area:next] ${COLUMN}`;
export const WS_AREA_RAIL = `min-w-0 @min-[720px]/ws:[grid-area:rail] ${COLUMN}`;
export const WS_AREA_TIME = `min-w-0 @min-[720px]/ws:[grid-area:time] ${COLUMN}`;

/** Column count the grid shows at a container width (documents the rules above; the test pins both together). */
export function workspaceColumns(width: number, drilled = false): 1 | 2 | 3 {
  if (width >= (drilled ? WS_BREAKPOINTS.drillWide : WS_BREAKPOINTS.three)) return 3;
  if (width >= WS_BREAKPOINTS.two) return 2;
  return 1;
}

/**
 * Overview body (RFE-186): main column (~70%) + a 300px sidebar from 900px of container width; stacked below that.
 * Keys off the same `@container/ws` as the other grids.
 */
export const WS_OVERVIEW_GRID =
  "mx-auto grid w-full max-w-[1240px] grid-cols-[minmax(0,1fr)] gap-6 @min-[900px]/ws:h-full @min-[900px]/ws:grid-cols-[minmax(0,1fr)_300px] @min-[900px]/ws:grid-rows-[minmax(0,1fr)]";

/** Overview scroller: the whole body scrolls when stacked (<900px); from 900px the grid is fixed-height and each column scrolls alone, so the sidebar never moves with the main column. */
export const WS_OVERVIEW_SCROLLER = "h-full min-h-0 overflow-y-auto overflow-x-clip @min-[900px]/ws:overflow-hidden";
export const WS_OVERVIEW_COLUMN = "min-w-0 @min-[900px]/ws:min-h-0 @min-[900px]/ws:overflow-y-auto";

/** Card shell shared by every workspace card (Overview, state cards, tab bodies): white, 1px border, 16px radius, 24px padding, no shadow. */
export const WS_CARD = "rounded-2xl border border-border bg-card p-4 shadow-none @min-[480px]/ws:p-6";
