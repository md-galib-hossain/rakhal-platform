import { FoldFact, foldReproduction } from './reproduction-fold';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const iso = (x: Date | null) => (x ? x.toISOString().slice(0, 10) : null);

const permutations = <T>(a: T[]): T[][] =>
  a.length <= 1
    ? [a]
    : a.flatMap((x, i) =>
        permutations([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [
          x,
          ...p,
        ]),
      );

describe('foldReproduction (RAKHAL-482)', () => {
  const ai: FoldFact = {
    id: 'b1',
    type: 'BREEDING',
    at: d('2026-06-01'),
    provenance: 'RECORDED',
  };
  const check: FoldFact = {
    id: 'p1',
    type: 'PREG_CHECK',
    at: d('2026-07-05'),
    provenance: 'RECORDED',
    result: 'PREGNANT',
  };
  const calving: FoldFact = {
    id: 'c1',
    type: 'CALVING',
    at: d('2027-03-08'),
    provenance: 'RECORDED',
  };

  it('any insertion order of the same facts gives the same result', () => {
    const facts: FoldFact[] = [
      ai,
      check,
      calving,
      {
        id: 'b2',
        type: 'BREEDING',
        at: d('2027-05-20'),
        provenance: 'RECORDED',
      },
      { id: 'h1', type: 'HEAT', at: d('2027-05-19'), provenance: 'RECORDED' },
    ];
    const expected = JSON.stringify(foldReproduction(facts));
    for (const p of permutations(facts)) {
      expect(JSON.stringify(foldReproduction(p))).toBe(expected);
    }
  });

  it('pregnant with no AI: a positive check alone is enough', () => {
    const r = foldReproduction([{ ...check, gestationDay: 60 }]);
    expect(r.hasActivePregnancy).toBe(true);
    expect(iso(r.pregnancy!.conceptionDate)).toBe('2026-05-06');
    expect(r.pregnancy!.confidence).toBe('ESTIMATED');
    expect(r.pendingBreeding).toBeNull();
  });

  it('positive check with nothing to date it: conception UNKNOWN, still pregnant', () => {
    const r = foldReproduction([check]);
    expect(r.hasActivePregnancy).toBe(true);
    expect(r.pregnancy!.conceptionDate).toBeNull();
    expect(r.pregnancy!.confidence).toBe('UNKNOWN');
  });

  it('a linked or pending breeding makes conception RECORDED', () => {
    const r = foldReproduction([ai, check]);
    expect(iso(r.pregnancy!.conceptionDate)).toBe('2026-06-01');
    expect(r.pregnancy!.confidence).toBe('RECORDED');
    expect(r.pendingBreeding).toBeNull();
  });

  it('calving with no pregnancy: valid, records the calving date', () => {
    const r = foldReproduction([calving]);
    expect(r.hasActivePregnancy).toBe(false);
    expect(iso(r.lastCalvingAt)).toBe('2027-03-08');
  });

  it('a calving closes the pregnancy and any pending breeding', () => {
    const r = foldReproduction([ai, check, calving]);
    expect(r.hasActivePregnancy).toBe(false);
    expect(r.pendingBreeding).toBeNull();
  });

  it('history last AI: bred and waiting for a check, marked historical', () => {
    const r = foldReproduction([{ ...ai, provenance: 'HISTORICAL' }]);
    expect(r.pendingBreeding).toMatchObject({ id: 'b1', historical: true });
    expect(iso(r.lastBreedingAt)).toBe('2026-06-01');
  });

  it('history last calving: sets the calving date without a pregnancy', () => {
    const r = foldReproduction([{ ...calving, provenance: 'HISTORICAL' }]);
    expect(iso(r.lastCalvingAt)).toBe('2027-03-08');
    expect(r.hasActivePregnancy).toBe(false);
  });

  it('a negative check, abortion or closed breeding clears the state', () => {
    expect(
      foldReproduction([ai, { ...check, result: 'NOT_PREGNANT' }])
        .pendingBreeding,
    ).toBeNull();
    expect(
      foldReproduction([
        ai,
        check,
        {
          id: 'a1',
          type: 'ABORTION',
          at: d('2026-09-01'),
          provenance: 'RECORDED',
        },
      ]).hasActivePregnancy,
    ).toBe(false);
    expect(
      foldReproduction([{ ...ai, open: false }]).pendingBreeding,
    ).toBeNull();
  });

  it('a suspected check keeps the breeding pending', () => {
    const r = foldReproduction([ai, { ...check, result: 'SUSPECTED' }]);
    expect(r.pendingBreeding?.id).toBe('b1');
    expect(r.hasActivePregnancy).toBe(false);
  });

  it('walkthrough E: a calving entered late slots into date order', () => {
    const lateCalving: FoldFact = {
      id: 'c9',
      type: 'CALVING',
      at: d('2027-03-08'),
      provenance: 'RECORDED',
    };
    const newAi: FoldFact = {
      id: 'b9',
      type: 'BREEDING',
      at: d('2027-05-25'),
      provenance: 'RECORDED',
    };
    const r = foldReproduction([newAi, lateCalving, check, ai]);
    expect(iso(r.lastCalvingAt)).toBe('2027-03-08');
    expect(r.hasActivePregnancy).toBe(false);
    expect(r.pendingBreeding?.id).toBe('b9');
  });
});
