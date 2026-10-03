/**
 * Pure dose/quantity conversion between catalog `Unit`s (protocols v2).
 *
 * WEIGHT converts to kg and VOLUME to L through `conversionToBase`. COUNT units (pcs/bag/dose/...)
 * have no inherent base, so a COUNT quantity only converts to the *same* unit.
 */
export interface UnitLike {
  id: string;
  symbol?: string;
  dimension: 'WEIGHT' | 'VOLUME' | 'COUNT';
  conversionToBase: number | null;
}

export function unitsCompatible(from: UnitLike, to: UnitLike): boolean {
  if (from.id === to.id) return true;
  if (from.dimension !== to.dimension) return false;
  if (from.dimension === 'COUNT') return false;
  return (
    typeof from.conversionToBase === 'number' &&
    from.conversionToBase > 0 &&
    typeof to.conversionToBase === 'number' &&
    to.conversionToBase > 0
  );
}

/** Convert `quantity` from one unit to another; throws when the units are not compatible. */
export function convertQuantity(
  quantity: number,
  from: UnitLike,
  to: UnitLike,
): number {
  if (from.id === to.id) return quantity;
  if (!unitsCompatible(from, to)) {
    throw new Error(
      `Cannot convert ${from.symbol ?? from.id} (${from.dimension}) to ${to.symbol ?? to.id} (${to.dimension})`,
    );
  }
  // Round away binary-float noise (0.1 g -> kg etc.) without losing real precision.
  const converted = (quantity * from.conversionToBase!) / to.conversionToBase!;
  return Math.round(converted * 1e9) / 1e9;
}
