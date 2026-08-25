/** The subset of a create-line request this pure shape check cares about —
 * kept decoupled from the presentation DTO class so the domain layer has no
 * framework dependency. Mirrors `sales/domain/sale-line-shape.ts`
 * (RAKHAL-339). */
export interface PurchaseLineDetailInput {
  medicineId?: string | null;
  feedItemId?: string | null;
  equipmentId?: string | null;
}

/**
 * Validates that a `PurchaseLine` create request carries exactly one of
 * `medicineId`/`feedItemId`/`equipmentId` — the application-level
 * enforcement of "real FK, not a polymorphic string"
 * (`FINANCE_V2_DESIGN.md` §5.1), mirroring `InventorySaleLine`'s own
 * identical shape rule (`sales/domain/sale-line-shape.ts`'s `INVENTORY`
 * case). Returns an error message, or `null` if the shape is valid. Pure —
 * no exceptions, no framework dependency; `PurchaseService` (application
 * layer) turns a non-null result into a `BadRequestException`.
 */
export function validatePurchaseLineDetailShape(
  line: PurchaseLineDetailInput,
): string | null {
  const fks = [line.medicineId, line.feedItemId, line.equipmentId].filter(
    (v): v is string => !!v,
  );
  return fks.length === 1
    ? null
    : 'A purchase line requires exactly one of medicineId, feedItemId, equipmentId';
}
