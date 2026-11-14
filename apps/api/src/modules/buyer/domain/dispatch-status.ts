/**
 * Derived-only status for a `MilkDispatch` (RAKHAL-366, MILESTONE 22 —
 * `BUSINESS_IA_PRD.md` §5.8). **Not a database column** — status is computed
 * from `cancelledAt`/`volumeReceivedL`, the same discipline
 * `ReceivableStatus` (RAKHAL-340, `finance-v2/receivables/domain/
 * receivable-status.ts`) already established: nothing ever writes this
 * value to Postgres.
 *
 * Derivation rule (`BUSINESS_IA_PRD.md` §5.8):
 *   cancelledAt != null    -> CANCELLED  (checked first — takes priority)
 *   volumeReceivedL == null -> PENDING
 *   else                    -> DELIVERED
 *
 * This maps onto the `volumeReceivedL`/`discrepancyL`/`discrepancyFlagged`
 * triple `MilkDispatch` already has — it invents no new state machine.
 */
export type DispatchStatus = 'PENDING' | 'DELIVERED' | 'CANCELLED';

export interface DispatchStatusInput {
  cancelledAt: Date | null;
  volumeReceivedL: number | null;
}

export function deriveDispatchStatus(
  dispatch: DispatchStatusInput,
): DispatchStatus {
  if (dispatch.cancelledAt != null) {
    return 'CANCELLED';
  }
  if (dispatch.volumeReceivedL == null) {
    return 'PENDING';
  }
  return 'DELIVERED';
}

/**
 * A dispatch with a posted `saleId` cannot be cancelled without reversing
 * its sale first — the sale is the revenue-recognition record, and
 * cancelling the dispatch underneath it would silently orphan a posted
 * `JournalTransaction`. Pure guard, no side effect. The actual cancel route
 * + sale-reversal cascade land in RAKHAL-377; this function is the
 * enforceable rule that route calls, exercised here via a unit test.
 */
export function assertDispatchCancellable(dispatch: {
  saleId: string | null;
  cancelledAt: Date | null;
}): void {
  if (dispatch.cancelledAt != null) {
    throw new Error('Dispatch is already cancelled.');
  }
  if (dispatch.saleId != null) {
    throw new Error(
      'Dispatch has a posted sale — reverse the sale before cancelling the dispatch.',
    );
  }
}
