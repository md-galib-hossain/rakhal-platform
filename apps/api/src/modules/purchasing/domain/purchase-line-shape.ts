/** Item kinds a purchase line can create inline (`newItem.kind`). */
export const PURCHASE_NEW_ITEM_KINDS = [
  'MEDICINE',
  'FEED',
  'EQUIPMENT',
] as const;
export type PurchaseNewItemKind = (typeof PURCHASE_NEW_ITEM_KINDS)[number];

/** The subset of a create-line request this pure shape check cares about —
 * kept decoupled from the presentation DTO class so the domain layer has no
 * framework dependency. Mirrors `sales/domain/sale-line-shape.ts`
 * (RAKHAL-339). */
export interface PurchaseLineDetailInput {
  medicineId?: string | null;
  feedItemId?: string | null;
  equipmentId?: string | null;
  /** Business UX Phase 2: create the item inside the purchase instead. */
  newItem?: {
    kind: string;
    ingredientId?: string | null;
    nutrition?: unknown;
  } | null;
}

/**
 * Validates that a `PurchaseLine` create request names its item exactly one
 * way: one of `medicineId`/`feedItemId`/`equipmentId` (an existing item — the
 * application-level enforcement of "real FK, not a polymorphic string",
 * `FINANCE_V2_DESIGN.md` §5.1, mirroring `InventorySaleLine`'s own identical
 * shape rule, `sales/domain/sale-line-shape.ts`) **or** a `newItem` to create
 * with the purchase. Returns an error message, or `null` if the shape is
 * valid. Pure — no exceptions, no framework dependency; `PurchaseService`
 * (application layer) turns a non-null result into a `BadRequestException`.
 */
export function validatePurchaseLineDetailShape(
  line: PurchaseLineDetailInput,
): string | null {
  const sources = [
    line.medicineId,
    line.feedItemId,
    line.equipmentId,
    line.newItem,
  ].filter((v) => !!v);
  if (sources.length !== 1) {
    return 'A purchase line requires exactly one of medicineId, feedItemId, equipmentId, newItem';
  }
  if (
    line.newItem?.kind === 'FEED' &&
    !line.newItem.ingredientId &&
    !line.newItem.nutrition
  ) {
    return 'A new feed item needs a nutrition profile or a catalogue ingredientId to copy it from';
  }
  return null;
}
