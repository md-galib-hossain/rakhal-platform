import { SaleLineType } from '@prisma/client';

/** The subset of a create-line request this pure shape check cares about — kept
 * decoupled from the presentation DTO class so the domain layer has no framework
 * dependency. */
export interface SaleLineDetailInput {
  type: SaleLineType;
  cattleId?: string | null;
  medicineId?: string | null;
  feedItemId?: string | null;
  equipmentId?: string | null;
}

/**
 * Validates that a `SaleLine` create request carries exactly the FK(s) its `type`
 * requires — the application-level enforcement of "real FK, not a polymorphic
 * string" (`FINANCE_V2_DESIGN.md` §5.1) since Prisma has no first-class "exactly one
 * of N optional FKs" constraint. Returns an error message, or `null` if the shape is
 * valid. Pure — no exceptions, no framework dependency; `SaleService` (application
 * layer) turns a non-null result into a `BadRequestException`.
 */
export function validateSaleLineDetailShape(
  line: SaleLineDetailInput,
): string | null {
  switch (line.type) {
    case SaleLineType.ANIMAL:
      return line.cattleId ? null : 'An ANIMAL sale line requires cattleId';
    case SaleLineType.INVENTORY: {
      const fks = [line.medicineId, line.feedItemId, line.equipmentId].filter(
        (v): v is string => !!v,
      );
      return fks.length === 1
        ? null
        : 'An INVENTORY sale line requires exactly one of medicineId, feedItemId, equipmentId';
    }
    case SaleLineType.MILK:
    case SaleLineType.MANURE:
      return null;
  }
}
