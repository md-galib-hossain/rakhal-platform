/** Common IANA zones for the farm-timezone picker — Bangladesh first (the default), then its neighbours and a few
 * global anchors. The backend accepts any valid IANA name, so a farm already on a zone outside this list keeps it:
 * `timezoneOptions` always adds the current value. */
export const COMMON_TIMEZONES = [
  "Asia/Dhaka",
  "Asia/Kolkata",
  "Asia/Karachi",
  "Asia/Kathmandu",
  "Asia/Colombo",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "Asia/Bangkok",
  "Asia/Jakarta",
  "Asia/Manila",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Africa/Nairobi",
  "Africa/Lagos",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "UTC",
] as const;

/** `UTC+06:00` style offset for `timezone` right now (Intl, so DST-aware). Empty string if unsupported. */
export function timezoneOffsetLabel(timezone: string): string {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "longOffset" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value;
    // "GMT+06:00" → "UTC+06:00"; a zone at offset 0 comes back as plain "GMT".
    return part ? part.replace("GMT", "UTC") : "";
  } catch {
    return "";
  }
}

export function timezoneLabel(timezone: string): string {
  const offset = timezoneOffsetLabel(timezone);
  return offset ? `${timezone.replace(/_/g, " ")} (${offset})` : timezone.replace(/_/g, " ");
}

/** The picker's options: the common list, plus `current` when it isn't in it. */
export function timezoneOptions(current?: string | null): Array<{ value: string; label: string }> {
  const zones: string[] = [...COMMON_TIMEZONES];
  if (current && !zones.includes(current)) zones.unshift(current);
  return zones.map((value) => ({ value, label: timezoneLabel(value) }));
}
