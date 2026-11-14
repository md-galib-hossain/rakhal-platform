import { ANIMAL_EVENT_TYPES, EVENT_CATALOGUE, EVENT_CHIPS } from './catalogue';
import { EventRegistry } from './event-registry';

describe('EventRegistry (RAKHAL-478)', () => {
  it('register() stores a definition and get() returns it', () => {
    const r = new EventRegistry();
    r.register(EVENT_CATALOGUE[0]);
    expect(r.get(EVENT_CATALOGUE[0].type)).toBe(EVENT_CATALOGUE[0]);
    expect(r.all()).toHaveLength(1);
  });

  it('refuses a duplicate type', () => {
    const r = new EventRegistry();
    r.register(EVENT_CATALOGUE[0]);
    expect(() => r.register(EVENT_CATALOGUE[0])).toThrow(
      /already registered: HEAT/,
    );
  });

  it('withCatalogue() loads every type exactly once', () => {
    const r = EventRegistry.withCatalogue();
    expect(
      r
        .all()
        .map((d) => d.type)
        .sort(),
    ).toEqual([...ANIMAL_EVENT_TYPES].sort());
  });
});

describe('EVENT_CATALOGUE eligibility (04 §3)', () => {
  const get = (t: string) => EVENT_CATALOGUE.find((d) => d.type === t)!;

  it('has a complete chip row for every type', () => {
    for (const d of EVENT_CATALOGUE) {
      expect(Object.keys(d.appliesTo).sort()).toEqual([...EVENT_CHIPS].sort());
    }
  });

  it('heat: not for males/calves; warns on pregnant and fattening', () => {
    const a = get('HEAT').appliesTo;
    expect(a.MALE).toBe('BLOCK');
    expect(a.CALF).toBe('BLOCK');
    expect(a.PREGNANT).toBe('WARN');
    expect(a.FATTENING).toBe('WARN');
    expect(a.OPEN).toBe('LISTED');
  });

  it('gives birth: listed for pregnant, warn for open', () => {
    const a = get('CALVING').appliesTo;
    expect(a.PREGNANT).toBe('LISTED');
    expect(a.OPEN).toBe('WARN');
  });

  it('fattening: enter is blocked for fattening animals, leave only for them', () => {
    expect(get('ENTER_FATTENING').appliesTo.FATTENING).toBe('BLOCK');
    expect(get('LEAVE_FATTENING').appliesTo.FATTENING).toBe('LISTED');
    expect(get('LEAVE_FATTENING').appliesTo.COW).toBe('BLOCK');
  });

  it('castration is male-only; weaning is calf-only; weight is for all', () => {
    expect(get('CASTRATION').hardRules).toContain('MALE_ONLY');
    expect(get('CASTRATION').appliesTo.FEMALE).toBe('BLOCK');
    expect(get('WEANING').appliesTo.COW).toBe('BLOCK');
    expect(
      Object.values(get('WEIGHT').appliesTo).every((v) => v === 'LISTED'),
    ).toBe(true);
  });

  it('every permission is a resource.action string', () => {
    for (const d of EVENT_CATALOGUE)
      expect(d.permission).toMatch(/^[\w-]+\.[\w-]+$/);
  });
});
