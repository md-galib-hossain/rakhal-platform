import {
  JournalAlreadyReversedError,
  JournalEmptyError,
  JournalInvalidLineError,
  JournalNotFoundError,
  JournalUnbalancedError,
  assertBalanced,
  mirrorForReversal,
} from './journal-balance';

describe('journal-balance domain (RAKHAL-334)', () => {
  describe('assertBalanced', () => {
    it('does not throw for a balanced two-line posting', () => {
      expect(() =>
        assertBalanced([
          { ledgerAccountId: 'acct-cash', debit: '100.00' },
          { ledgerAccountId: 'acct-revenue', credit: '100.00' },
        ]),
      ).not.toThrow();
    });

    it('does not throw for a balanced multi-line posting summing via Decimal, not float', () => {
      // 0.1 + 0.2 is the classic float trap — this proves Decimal-safe summation.
      expect(() =>
        assertBalanced([
          { ledgerAccountId: 'acct-a', debit: '0.10' },
          { ledgerAccountId: 'acct-b', debit: '0.20' },
          { ledgerAccountId: 'acct-c', credit: '0.30' },
        ]),
      ).not.toThrow();
    });

    it('throws JournalUnbalancedError when debits and credits differ', () => {
      expect(() =>
        assertBalanced([
          { ledgerAccountId: 'acct-cash', debit: '100.00' },
          { ledgerAccountId: 'acct-revenue', credit: '99.99' },
        ]),
      ).toThrow(JournalUnbalancedError);
    });

    it('throws JournalUnbalancedError for a float-precision near-miss (99.99999... !== 100)', () => {
      expect(() =>
        assertBalanced([
          { ledgerAccountId: 'acct-a', debit: '0.1' },
          { ledgerAccountId: 'acct-b', debit: '0.2' },
          { ledgerAccountId: 'acct-c', credit: '0.30000001' },
        ]),
      ).toThrow(JournalUnbalancedError);
    });

    it('throws JournalEmptyError for zero lines', () => {
      expect(() => assertBalanced([])).toThrow(JournalEmptyError);
    });

    it('throws JournalInvalidLineError for a negative debit', () => {
      expect(() =>
        assertBalanced([
          { ledgerAccountId: 'acct-a', debit: '-10.00' },
          { ledgerAccountId: 'acct-b', credit: '-10.00' },
        ]),
      ).toThrow(JournalInvalidLineError);
    });

    it('throws JournalInvalidLineError for a negative credit', () => {
      expect(() =>
        assertBalanced([
          { ledgerAccountId: 'acct-a', debit: '10.00' },
          { ledgerAccountId: 'acct-b', credit: '-10.00' },
        ]),
      ).toThrow(JournalInvalidLineError);
    });

    it('throws JournalInvalidLineError when a single line has both a debit and a credit', () => {
      expect(() =>
        assertBalanced([
          { ledgerAccountId: 'acct-a', debit: '10.00', credit: '10.00' },
        ]),
      ).toThrow(JournalInvalidLineError);
    });

    it('allows more than two lines as long as the totals balance', () => {
      expect(() =>
        assertBalanced([
          { ledgerAccountId: 'acct-cash', debit: '40.00' },
          { ledgerAccountId: 'acct-bank', debit: '60.00' },
          { ledgerAccountId: 'acct-revenue', credit: '100.00' },
        ]),
      ).not.toThrow();
    });
  });

  describe('mirrorForReversal', () => {
    it('swaps debit and credit on every line', () => {
      const mirrored = mirrorForReversal([
        { ledgerAccountId: 'acct-cash', debit: '100.00' },
        { ledgerAccountId: 'acct-revenue', credit: '100.00' },
      ]);
      expect(mirrored).toEqual([
        { ledgerAccountId: 'acct-cash', debit: 0, credit: '100.00' },
        { ledgerAccountId: 'acct-revenue', debit: '100.00', credit: 0 },
      ]);
    });

    it('produces a balanced set of lines from an already-balanced original', () => {
      const original = [
        { ledgerAccountId: 'acct-cash', debit: '40.00' },
        { ledgerAccountId: 'acct-bank', debit: '60.00' },
        { ledgerAccountId: 'acct-revenue', credit: '100.00' },
      ];
      expect(() => assertBalanced(mirrorForReversal(original))).not.toThrow();
    });
  });

  describe('error classes', () => {
    it('JournalNotFoundError carries the id in its message', () => {
      expect(new JournalNotFoundError('jt_123').message).toContain('jt_123');
    });

    it('JournalAlreadyReversedError carries the id in its message', () => {
      expect(new JournalAlreadyReversedError('jt_456').message).toContain(
        'jt_456',
      );
    });
  });
});
