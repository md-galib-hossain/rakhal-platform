/** MILESTONE 31 — the 4 workspace sections that replace the old 8 detail tabs (03 §3.2, §9). */
export const SECTIONS = ["overview", "timeline", "feeding", "family", "money"] as const;
export type SectionKey = (typeof SECTIONS)[number];

/** Old `?tab=` deep links (e.g. the feeding fit pill's `&tab=feeding`) keep working. */
const LEGACY_TAB_TO_SECTION: Record<string, SectionKey> = {
  overview: "overview",
  performance: "timeline",
  reproduction: "timeline",
  health: "timeline",
  tasks: "timeline",
  feeding: "feeding",
  pedigree: "family",
  finance: "money",
};

/** `?section=` wins, then a legacy `?tab=`, else Overview (the default since RFE-180); `?section=timeline` links keep working. Money is only reachable with finance permission. */
export function resolveSection(section: string | null, legacyTab: string | null, canSeeMoney: boolean): SectionKey {
  const fromParam = (SECTIONS as readonly string[]).includes(section ?? "") ? (section as SectionKey) : null;
  const resolved = fromParam ?? (legacyTab ? LEGACY_TAB_TO_SECTION[legacyTab] : undefined) ?? "overview";
  return resolved === "money" && !canSeeMoney ? "overview" : resolved;
}
