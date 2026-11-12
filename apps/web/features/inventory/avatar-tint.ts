/** Deterministic per-medicine tint for the no-image thumbnail fallback — same rotation as
 * `features/cattle/avatar-tint.ts` (kept feature-local rather than cross-imported, matching this
 * codebase's per-feature siloing convention), reused here since medicine rows have the same
 * "most demo rows have no uploaded image yet" problem. */
const AVATAR_TINTS = [
  "bg-accent-indigo-tint text-accent-indigo",
  "bg-info-tint text-info",
  "bg-success-tint text-success",
  "bg-warning-tint text-warning",
  "bg-accent-pink-tint text-accent-pink",
  "bg-accent-teal-tint text-accent-teal",
  "bg-accent-purple-tint text-accent-purple",
] as const;

export function avatarTint(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length];
}
