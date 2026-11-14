import { compareMetric, safePercentChange, valueOf } from './metric-value';

describe('safePercentChange', () => {
  it('computes a normal change', () =>
    expect(safePercentChange(150, 100)).toBe(50));
  it('handles a decrease', () => expect(safePercentChange(50, 100)).toBe(-50));
  it('is null when previous is 0', () =>
    expect(safePercentChange(10, 0)).toBeNull());
  it('is null for 0 -> 0', () => expect(safePercentChange(0, 0)).toBeNull());
  it('is null for non-finite input', () => {
    expect(safePercentChange(NaN, 1)).toBeNull();
    expect(safePercentChange(1, Infinity)).toBeNull();
  });
  it('uses |previous| for negative baselines', () =>
    expect(safePercentChange(-5, -10)).toBe(50));
});

describe('compareMetric', () => {
  it('compares two values', () => {
    const c = compareMetric(valueOf(120, 'L'), valueOf(100, 'L'));
    expect(c.absoluteChange).toBe(20);
    expect(c.percentChange).toBe(20);
    expect(c.previousState).toBe('value');
  });
  it('explicit zero previous: absolute set, percent null', () => {
    const c = compareMetric(valueOf(5, 'L'), valueOf(0, 'L'));
    expect(c.absoluteChange).toBe(5);
    expect(c.percentChange).toBeNull();
  });
  it('missing previous is not treated as zero', () => {
    const c = compareMetric(valueOf(5, 'L'), {
      state: 'missing',
      reason: 'no log',
    });
    expect(c.absoluteChange).toBeNull();
    expect(c.percentChange).toBeNull();
    expect(c.previousState).toBe('missing');
  });
  it('non-value current yields no change', () => {
    const c = compareMetric({ state: 'not_applicable' }, valueOf(5, 'L'));
    expect(c.absoluteChange).toBeNull();
    expect(c.percentChange).toBeNull();
  });
});
