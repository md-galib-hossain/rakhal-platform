/**
 * Human-readable Farm ID (RAKHAL-021, PRD §5.1 Step 2), e.g. `GVD-2026-001`.
 * Mirrors `formatInvoiceNumber` (RAKHAL-237) — a config/user-supplied prefix
 * paired with a zero-padded sequential value taken from `FarmCounter`, scoped
 * per year so the serial resets annually.
 */
export function formatFarmCode(
  prefix: string,
  year: number,
  serial: number,
): string {
  return `${prefix}-${year}-${String(serial).padStart(3, '0')}`;
}

/**
 * Derive a fallback tag/ID prefix from the farm name when the owner doesn't
 * supply one at create time, e.g. "Green Valley Dairy" → "GVD". Falls back to
 * "FARM" if the name yields no alphabetic initials.
 */
export function deriveFarmPrefix(name: string): string {
  const initials = name
    .split(/\s+/)
    .map((word) => word.replace(/[^a-zA-Z]/g, '').charAt(0))
    .filter(Boolean)
    .join('')
    .toUpperCase();
  return (initials || 'FARM').slice(0, 4);
}
