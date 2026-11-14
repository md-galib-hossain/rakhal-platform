import {
  buildMetricRegistry,
  METRIC_MODULES,
  METRIC_REGISTRY,
} from './registry';

describe('metric registry', () => {
  const defs = Object.values(METRIC_REGISTRY);

  it('registers every definition from every module with a unique id', () => {
    const total = Object.values(METRIC_MODULES).reduce(
      (n, m) => n + (m?.definitions.length ?? 0),
      0,
    );
    expect(defs.length).toBe(total);
    expect(defs.length).toBeGreaterThan(0);
  });

  it('prefixes each id with its own domain', () => {
    for (const d of defs) expect(d.id.startsWith(`${d.domain}.`)).toBe(true);
  });

  it('documents formula, eligibility and missing-data rule for every metric', () => {
    for (const d of defs) {
      expect(d.formula.trim()).not.toBe('');
      expect(d.eligibilityRule.trim()).not.toBe('');
      expect(d.missingDataRule.trim()).not.toBe('');
      expect(d.calcVersion).toBeGreaterThanOrEqual(1);
    }
  });

  it('gates every finance-domain metric behind finance.read', () => {
    for (const d of defs.filter((x) => x.domain === 'finance')) {
      expect(d.requiresPermission).toBe('finance.read');
    }
  });

  it('gates every BDT-unit metric behind finance.read (any domain)', () => {
    const isBdt = (u: string) => u === 'BDT' || u.startsWith('BDT/');
    const offenders = defs
      .filter((d) => isBdt(d.unit))
      .filter((d) => d.requiresPermission !== 'finance.read')
      .map((d) => d.id);
    expect(offenders).toEqual([]);
  });

  it('rejects a duplicate id', () => {
    const milk = METRIC_MODULES.milk!;
    expect(() => buildMetricRegistry({ milk, health: milk })).toThrow(
      /Duplicate metric id/,
    );
  });
});
