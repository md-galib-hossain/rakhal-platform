const TINTS = [
  "bg-info-tint text-info",
  "bg-accent-teal-tint text-accent-teal",
  "bg-accent-purple-tint text-accent-purple",
  "bg-accent-indigo-tint text-accent-indigo",
  "bg-success-tint text-success",
];

/** Deterministic tint for an actor's fallback-initial avatar — same hash approach as
 * `features/inventory/avatar-tint.ts` / `features/cattle/avatar-tint.ts`. */
export function avatarTint(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return TINTS[hash % TINTS.length];
}
