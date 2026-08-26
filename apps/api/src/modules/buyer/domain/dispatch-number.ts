/**
 * Milk dispatch numbering (RAKHAL-366, MILESTONE 22 — `BUSINESS_IA_PRD.md`
 * §5.8). Pure formatting only — no Prisma/framework dependency (domain
 * layer). Mirrors `sales/domain/sale-number.ts` exactly: `DSP-NNNNNN`
 * (6-digit zero-padded, single continuous per-farm sequence, never resets),
 * allocated via the same `FarmCounter` upsert pattern
 * (`infrastructure/dispatch-number.allocator.ts`).
 */

export const DISPATCH_NUMBER_PREFIX = 'DSP';

/** `FarmCounter.scope` for a farm's dispatch-number sequence. */
export function dispatchCounterScope(farmId: string): string {
  return `dispatch:${farmId}`;
}

/** Formats a counter value into a human-readable dispatch number, e.g. `DSP-000123`. */
export function formatDispatchNumber(value: number): string {
  return `${DISPATCH_NUMBER_PREFIX}-${String(value).padStart(6, '0')}`;
}
