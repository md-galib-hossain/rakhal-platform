import { EVENT_CATALOGUE } from '../catalogue';
import { AnimalFacts, CategoryContext, categoriesOf } from './categories';
import { evaluateEligibility } from './evaluate';

const now = new Date('2026-10-29T00:00:00.000Z');
const ctx: CategoryContext = {
  now,
  weaningDays: 60,
  breedingAgeDays: 450,
  freshDays: 21,
};
const born = (d: number) => new Date(now.getTime() - d * 86400000);
const facts = (o: Partial<AnimalFacts>): AnimalFacts => ({
  gender: 'FEMALE',
  dateOfBirth: born(1200),
  totalCalvings: 2,
  productionStatus: 'MILKING',
  reproductiveStatus: 'OPEN',
  activeLactationStart: born(100),
  inFattening: false,
  ...o,
});
const def = (t: string) => EVENT_CATALOGUE.find((d) => d.type === t)!;
const level = (t: string, f: AnimalFacts, extra = {}) =>
  evaluateEligibility(def(t), { facts: f, ctx, ...extra }).level;

describe('categoriesOf (RAKHAL-480)', () => {
  it('a milking open cow', () => {
    expect(categoriesOf(facts({}), ctx)).toEqual([
      'ALL',
      'FEMALE',
      'COW',
      'MILKING',
      'OPEN',
    ]);
  });
  it('fresh = milking within lactationFreshDays; post-calving wait is open', () => {
    const f = facts({
      activeLactationStart: born(10),
      reproductiveStatus: 'POSTPARTUM_WAITING',
    });
    expect(categoriesOf(f, ctx)).toEqual(
      expect.arrayContaining(['FRESH', 'OPEN']),
    );
  });
  it('weaned ends at the breeding age', () => {
    const a = facts({ dateOfBirth: born(200), totalCalvings: 0 });
    expect(categoriesOf(a, ctx)).toContain('WEANED');
    expect(categoriesOf(facts({ dateOfBirth: born(500) }), ctx)).not.toContain(
      'WEANED',
    );
  });
});

describe('evaluateEligibility (RAKHAL-480)', () => {
  it('heat: ok for an open cow, warn when pregnant, blocked for a bull or calf', () => {
    expect(level('HEAT', facts({}))).toBe('LISTED');
    expect(level('HEAT', facts({ reproductiveStatus: 'PREGNANT' }))).toBe(
      'WARN',
    );
    expect(level('HEAT', facts({ gender: 'MALE' }))).toBe('BLOCK');
    expect(
      level('HEAT', facts({ dateOfBirth: born(20), totalCalvings: 0 })),
    ).toBe('BLOCK');
  });
  it('dry off is blocked when already dry', () => {
    expect(level('DRY_OFF', facts({ productionStatus: 'DRY' }))).toBe('BLOCK');
  });
  it('leave fattening needs the fattening chip; enter is blocked when already in', () => {
    expect(level('LEAVE_FATTENING', facts({}))).toBe('BLOCK');
    expect(level('LEAVE_FATTENING', facts({ inFattening: true }))).toBe(
      'LISTED',
    );
    expect(level('ENTER_FATTENING', facts({ inFattening: true }))).toBe(
      'BLOCK',
    );
  });
  it('hard rules: future date, before birth, left herd', () => {
    const f = facts({});
    const r = evaluateEligibility(def('WEIGHT'), {
      facts: f,
      ctx,
      date: new Date('2027-01-01'),
    });
    expect(r.findings.map((x) => x.code)).toContain('DATE_IN_FUTURE');
    expect(level('WEIGHT', f, { date: born(5000) })).toBe('BLOCK');
    expect(level('WEIGHT', f, { leftHerd: true })).toBe('BLOCK');
  });
});
