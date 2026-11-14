import {
  computeExpiryStatus,
  computeStockStatus,
  isExpired,
} from './medicine-status';

describe('medicine-status', () => {
  describe('computeStockStatus', () => {
    it('returns out when stock is zero or below', () => {
      expect(computeStockStatus(0, 10)).toBe('out');
      expect(computeStockStatus(-5, 10)).toBe('out');
    });

    it('returns low at or below the threshold', () => {
      expect(computeStockStatus(10, 10)).toBe('low');
      expect(computeStockStatus(3, 10)).toBe('low');
    });

    it('returns adequate above the threshold', () => {
      expect(computeStockStatus(11, 10)).toBe('adequate');
    });
  });

  describe('computeExpiryStatus', () => {
    const now = new Date('2026-06-01T00:00:00.000Z');

    it('returns expired when the date has passed', () => {
      expect(computeExpiryStatus(new Date('2026-05-31T00:00:00Z'), now)).toBe(
        'expired',
      );
    });

    it('returns expiring_soon within 30 days', () => {
      expect(computeExpiryStatus(new Date('2026-06-20T00:00:00Z'), now)).toBe(
        'expiring_soon',
      );
    });

    it('returns ok beyond 30 days', () => {
      expect(computeExpiryStatus(new Date('2026-08-01T00:00:00Z'), now)).toBe(
        'ok',
      );
    });
  });

  describe('isExpired', () => {
    const now = new Date('2026-06-01T00:00:00.000Z');

    it('is true on or before now', () => {
      expect(isExpired(new Date('2026-05-01T00:00:00Z'), now)).toBe(true);
      expect(isExpired(now, now)).toBe(true);
    });

    it('is false in the future', () => {
      expect(isExpired(new Date('2026-07-01T00:00:00Z'), now)).toBe(false);
    });
  });
});
