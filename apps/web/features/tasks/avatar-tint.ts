const TINTS = [
  "bg-info-tint text-info",
  "bg-accent-teal-tint text-accent-teal",
  "bg-accent-purple-tint text-accent-purple",
  "bg-accent-indigo-tint text-accent-indigo",
  "bg-success-tint text-success",
];

/** Deterministic tint for an assignee's fallback-initial avatar — same hash approach as
 * `features/activity/avatar-tint.ts` / `features/inventory/avatar-tint.ts`. */
export function avatarTint(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return TINTS[hash % TINTS.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}
