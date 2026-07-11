/** Deterministic per-cattle tint for the no-photo avatar fallback — Figma's mock has a real photo
 * on every row, so a flat `bg-muted` circle reads much greyer/flatter than the design in practice
 * (most demo/seed cattle have no uploaded photo yet). Rotates through the existing accent tokens
 * (no new colors) keyed on the cattle id, so the same animal gets the same tint in the list row,
 * the detail drawer, and the detail page. */
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
