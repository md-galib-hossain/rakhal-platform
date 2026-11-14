import { PayableStatus } from './payable-status';
import { derivePurchasePayment } from './purchase-payment';

const NOW = new Date('2026-10-19T00:00:00Z');
const future = new Date('2026-11-01T00:00:00Z');
const past = new Date('2026-10-01T00:00:00Z');

describe('derivePurchasePayment', () => {
  it('no payable = paid in full at creation', () => {
    expect(derivePurchasePayment('1000.00', false, null, 0, NOW)).toEqual({
      paymentStatus: PayableStatus.PAID,
      outstanding: '0.00',
      paidAmount: '1000.00',
    });
  });

  it('voided purchase is neither owed nor paid', () => {
    expect(
      derivePurchasePayment(
        '1000.00',
        true,
        { totalAmount: '600.00', dueDate: past },
        0,
        NOW,
      ),
    ).toEqual({ paymentStatus: null, outstanding: '0.00', paidAmount: '0.00' });
  });

  it('part paid up front, nothing since: unpaid remainder, paidAmount counts the up-front part', () => {
    expect(
      derivePurchasePayment(
        '1000.00',
        false,
        { totalAmount: '600.00', dueDate: future },
        0,
        NOW,
      ),
    ).toEqual({
      paymentStatus: PayableStatus.UNPAID,
      outstanding: '600.00',
      paidAmount: '400.00',
    });
  });

  it('partially settled later', () => {
    expect(
      derivePurchasePayment(
        '1000.00',
        false,
        { totalAmount: '600.00', dueDate: null },
        '250.00',
        NOW,
      ),
    ).toEqual({
      paymentStatus: PayableStatus.PARTIALLY_PAID,
      outstanding: '350.00',
      paidAmount: '650.00',
    });
  });

  it('fully settled later', () => {
    expect(
      derivePurchasePayment(
        '1000.00',
        false,
        { totalAmount: '600.00', dueDate: past },
        '600.00',
        NOW,
      ),
    ).toEqual({
      paymentStatus: PayableStatus.PAID,
      outstanding: '0.00',
      paidAmount: '1000.00',
    });
  });

  it('past due and still owing is OVERDUE, even when partly paid', () => {
    expect(
      derivePurchasePayment(
        '1000.00',
        false,
        { totalAmount: '1000.00', dueDate: past },
        '100.00',
        NOW,
      ).paymentStatus,
    ).toBe(PayableStatus.OVERDUE);
  });
});
