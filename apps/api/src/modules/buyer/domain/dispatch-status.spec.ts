import {
  deriveDispatchStatus,
  assertDispatchCancellable,
} from './dispatch-status';

describe('deriveDispatchStatus', () => {
  it('returns CANCELLED when cancelledAt is set, regardless of volumeReceivedL', () => {
    expect(
      deriveDispatchStatus({ cancelledAt: new Date(), volumeReceivedL: 100 }),
    ).toBe('CANCELLED');
    expect(
      deriveDispatchStatus({ cancelledAt: new Date(), volumeReceivedL: null }),
    ).toBe('CANCELLED');
  });

  it('returns PENDING when not cancelled and volumeReceivedL is null', () => {
    expect(
      deriveDispatchStatus({ cancelledAt: null, volumeReceivedL: null }),
    ).toBe('PENDING');
  });

  it('returns DELIVERED when not cancelled and volumeReceivedL is set', () => {
    expect(
      deriveDispatchStatus({ cancelledAt: null, volumeReceivedL: 95 }),
    ).toBe('DELIVERED');
  });
});

describe('assertDispatchCancellable', () => {
  it('throws when already cancelled', () => {
    expect(() =>
      assertDispatchCancellable({ saleId: null, cancelledAt: new Date() }),
    ).toThrow('already cancelled');
  });

  it('throws when a sale is posted', () => {
    expect(() =>
      assertDispatchCancellable({ saleId: 'sale_1', cancelledAt: null }),
    ).toThrow('posted sale');
  });

  it('allows cancelling a dispatch with no sale and not already cancelled', () => {
    expect(() =>
      assertDispatchCancellable({ saleId: null, cancelledAt: null }),
    ).not.toThrow();
  });
});
