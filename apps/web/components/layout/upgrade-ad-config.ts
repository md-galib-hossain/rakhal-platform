/**
 * Local placeholder cadence for the sidebar's upgrade ad (2026-07-10 design pass: it's an ad slot,
 * not a fixed banner — it should surface a handful of times over a session, not sit docked forever).
 * "5-10 times a day" from the design brief, approximated as a fixed interval while the tab is open
 * (there's no per-user impression tracking yet) — tuned so a ~10-12h open workday lands in that
 * range. Eligibility (who sees it at all) is real as of RFE-008 —
 * `features/subscription/hooks/use-subscription-gates.ts#useIsEligibleForUpgradeAd`; admin-configurable
 * cadence would be a further RFE-008 follow-up, not built here.
 */
export const UPGRADE_AD_CONFIG = {
  /** Time between ad appearances. */
  intervalMs: 90 * 60 * 1000,
  /** How long each appearance stays up before auto-retracting. */
  visibleDurationMs: 12_000,
  /** Delay before the very first appearance after the shell mounts — avoids greeting a fresh
   * session with an ad before the user has even looked at the nav. */
  initialDelayMs: 20_000,
};
