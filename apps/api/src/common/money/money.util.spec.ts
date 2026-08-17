import { Prisma } from '@prisma/client';
import {
  add,
  clampNonNegative,
  eq,
  gt,
  gte,
  isNegative,
  isZero,
  lt,
  lte,
  multiply,
  round2,
  subtract,
  sum,
  toMoney,
  toStorage,
  zero,
} from './money.util';

const D = (n: Prisma.Decimal.Value) => new Prisma.Decimal(n);

describe('common/money', () => {
  describe('the classic 0.1 + 0.2 float trap', () => {
    it('JS number arithmetic does NOT equal 0.3 (documents the bug this module exists to remove)', () => {
      expect(0.1 + 0.2).not.toBe(0.3);
      expect(0.1 + 0.2).toBeCloseTo(0.3); // only "close", not exact
    });

    it('Decimal-based add() gives the exact value, no float drift', () => {
      const result = add('0.1', '0.2');
      expect(result.toString()).toBe('0.3');
      expect(eq(result, '0.3')).toBe(true);
    });

    it('holds under repeated addition where floats visibly drift', () => {
      let total = zero();
      for (let i = 0; i < 10; i++) {
        total = add(total, '0.1');
      }
      expect(total.toString()).toBe('1');
      expect(eq(total, 1)).toBe(true);

      // The float equivalent famously does NOT land on 1.
      let floatTotal = 0;
      for (let i = 0; i < 10; i++) floatTotal += 0.1;
      expect(floatTotal).not.toBe(1);
    });
  });

  describe('toMoney / zero', () => {
    it('constructs from number, string, and Decimal', () => {
      expect(toMoney(5).toString()).toBe('5');
      expect(toMoney('5.5').toString()).toBe('5.5');
      expect(toMoney(D('5.5')).toString()).toBe('5.5');
    });

    it('zero() is ৳0.00', () => {
      expect(isZero(zero())).toBe(true);
    });
  });

  describe('add / subtract / multiply / sum', () => {
    it('adds two amounts', () => {
      expect(add('100.50', '49.50').toString()).toBe('150');
    });

    it('subtracts two amounts, allowing negative results', () => {
      expect(subtract('100', '150').toString()).toBe('-50');
    });

    it('multiplies money by a plain factor (e.g. unit price × quantity)', () => {
      expect(multiply('12.50', 4).toString()).toBe('50');
      expect(multiply('99.99', '0.15').toString()).toBe('14.9985');
    });

    it('sums a list of amounts, empty list sums to zero', () => {
      expect(sum(['10', '20.25', '0.75']).toString()).toBe('31');
      expect(isZero(sum([]))).toBe(true);
    });
  });

  describe('compare: gt/gte/lt/lte/eq', () => {
    it('gt / gte', () => {
      expect(gt('10', '5')).toBe(true);
      expect(gt('5', '5')).toBe(false);
      expect(gte('5', '5')).toBe(true);
      expect(gte('4.99', '5')).toBe(false);
    });

    it('lt / lte', () => {
      expect(lt('5', '10')).toBe(true);
      expect(lt('5', '5')).toBe(false);
      expect(lte('5', '5')).toBe(true);
      expect(lte('5.01', '5')).toBe(false);
    });

    it('eq treats value-equal decimals as equal regardless of trailing zeros', () => {
      expect(eq('1', '1.0')).toBe(true);
      expect(eq('1', '1.01')).toBe(false);
    });
  });

  describe('negative amounts', () => {
    it('isNegative detects negative values', () => {
      expect(isNegative('-0.01')).toBe(true);
      expect(isNegative('0')).toBe(false);
      expect(isNegative('0.01')).toBe(false);
    });

    it('subtracting a larger amount yields a correctly signed negative Decimal', () => {
      const result = subtract('30', '100');
      expect(result.toString()).toBe('-70');
      expect(isNegative(result)).toBe(true);
    });

    it('clampNonNegative floors negative values at zero, leaves non-negative untouched', () => {
      expect(clampNonNegative('-5.50').toString()).toBe('0');
      expect(clampNonNegative('5.50').toString()).toBe('5.5');
      expect(clampNonNegative('0').toString()).toBe('0');
    });
  });

  describe('round2 / toStorage — rounding behavior', () => {
    it('rounds half-up to 2 dp', () => {
      expect(round2('100.125').toString()).toBe('100.13');
      expect(round2('100.124').toString()).toBe('100.12');
      expect(round2('2500').toString()).toBe('2500');
    });

    it('rounds half-up on negative amounts too (away from zero)', () => {
      expect(round2('-100.125').toString()).toBe('-100.13');
      expect(round2('-100.124').toString()).toBe('-100.12');
    });

    it('toStorage is round2 — safe to hand directly to a Decimal(18,2) column', () => {
      expect(toStorage('14.9985').toString()).toBe(
        round2('14.9985').toString(),
      );
      expect(toStorage('14.9985').toString()).toBe('15');
    });
  });
});
