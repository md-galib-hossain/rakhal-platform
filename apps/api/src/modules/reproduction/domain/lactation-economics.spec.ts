import {
  allocateGroupFeedCost,
  computeDiscardedWithheldValue,
  computeLactationMargin,
  computeMilkRevenue,
} from './lactation-economics';

describe('computeMilkRevenue', () => {
  it('multiplies saleable litres by the effective rate', () => {
    expect(computeMilkRevenue(500, 55)).toBe(27500);
  });

  it('rounds to 2 decimal places', () => {
    expect(computeMilkRevenue(10.333, 3)).toBe(31);
    expect(computeMilkRevenue(10.335, 3)).toBeCloseTo(31.01, 2);
  });

  it('returns 0 for 0 saleable litres', () => {
    expect(computeMilkRevenue(0, 55)).toBe(0);
  });
});

describe('computeDiscardedWithheldValue', () => {
  it('values withheld + discarded litres together at the same rate as revenue', () => {
    expect(computeDiscardedWithheldValue(10, 5, 55)).toBe(825);
  });

  it('returns 0 when nothing was withheld or discarded', () => {
    expect(computeDiscardedWithheldValue(0, 0, 55)).toBe(0);
  });
});

describe('allocateGroupFeedCost', () => {
  it('splits the group cost evenly across headcount', () => {
    expect(allocateGroupFeedCost(1000, 10)).toBe(100);
  });

  it('guards divide-by-zero when the group has no headcount', () => {
    expect(allocateGroupFeedCost(1000, 0)).toBe(0);
  });

  it('guards a negative headcount defensively', () => {
    expect(allocateGroupFeedCost(1000, -1)).toBe(0);
  });

  it('rounds to 2 decimal places', () => {
    expect(allocateGroupFeedCost(100, 3)).toBe(33.33);
  });
});

describe('computeLactationMargin', () => {
  it('sums every cost bucket (including discarded/withheld value) and subtracts from revenue', () => {
    const result = computeLactationMargin({
      milkRevenue: 10000,
      feedCost: 3000,
      medicineCost: 500,
      breedingCost: 200,
      discardedWithheldValue: 300,
    });
    expect(result).toEqual({
      milkRevenue: 10000,
      feedCost: 3000,
      medicineCost: 500,
      breedingCost: 200,
      discardedWithheldValue: 300,
      totalCost: 4000,
      margin: 6000,
    });
  });

  it('allows a negative margin when costs exceed revenue', () => {
    const result = computeLactationMargin({
      milkRevenue: 1000,
      feedCost: 800,
      medicineCost: 300,
      breedingCost: 0,
      discardedWithheldValue: 0,
    });
    expect(result.totalCost).toBe(1100);
    expect(result.margin).toBe(-100);
  });

  it('handles an all-zero lactation with no revenue or costs yet', () => {
    const result = computeLactationMargin({
      milkRevenue: 0,
      feedCost: 0,
      medicineCost: 0,
      breedingCost: 0,
      discardedWithheldValue: 0,
    });
    expect(result.totalCost).toBe(0);
    expect(result.margin).toBe(0);
  });
});
