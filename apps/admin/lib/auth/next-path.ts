/**
 * The `?next=` target after sign-in. Only same-site absolute paths are honoured, so a crafted
 * link cannot bounce an admin to another origin (open redirect). Anything else falls back to "/".
 */
export function safeNextPath(value: string | string[] | null | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/";
  // Never bounce back into the auth screens or the BFF.
  if (raw.startsWith("/login") || raw.startsWith("/api/")) return "/";
  return raw;
}
