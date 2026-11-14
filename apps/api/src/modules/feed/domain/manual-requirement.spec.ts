import {
  isManualStale,
  requirementsFromManual,
  validateManualValues,
} from './manual-requirement';
import { DEFAULT_REQUIREMENT_SETTINGS as S } from './requirement-settings';

describe('requirementsFromManual', () => {
  const r = requirementsFromManual({ dmKg: 12, cpKg: 1.9, meMj: 150 }, S);

  it('keeps the entered DM/CP/ME', () => {
    expect([r.dmKg, r.cpKg, r.meMj]).toEqual([12, 1.9, 150]);
  });

  it('derives density figures from the manual values', () => {
    expect(r.cpPctOfDm).toBeCloseTo(15.83, 2);
    expect(r.energyDensityMjPerKgDm).toBe(12.5);
    expect(r.neMcal).toBeCloseTo((150 / 4.184) * S.netEnergyEfficiency, 2);
  });

  it('follows the farm settings shares of the MANUAL dm', () => {
    expect(r.ndfKg).toBeCloseTo(S.ndfMinShareOfIntake * 12, 2);
    expect(r.ndfMaxKg).toBeCloseTo(S.ndfMaxShareOfIntake * 12, 2);
    expect(r.fatKg).toBeCloseTo(S.fatShareOfIntake * 12, 2);
    expect(r.adfKg).toBeCloseTo(S.adfShareOfIntake * 12, 2);
    expect(r.tdnKg).toBeCloseTo(S.tdnShareOfIntake * 12, 2);
    const other = requirementsFromManual(
      { dmKg: 12, cpKg: 1.9, meMj: 150 },
      { ...S, tdnShareOfIntake: 0.5 },
    );
    expect(other.tdnKg).toBe(6);
  });

  it('carries farm constants and leaves Ca/P/breakdown unset', () => {
    expect(r.rdpPct).toBe(S.degradableProteinShare);
    expect(r.rupPct).toBe(S.undegradableProteinShare);
    expect(r.caPRatioTarget).toBe(S.calciumToPhosphorusTarget);
    expect(r.calciumKg).toBeNull();
    expect(r.phosphorusKg).toBeNull();
    expect(r.breakdown).toBeNull();
  });
});

describe('isManualStale', () => {
  const snap = {
    dm_kg: 10,
    cp_kg: 1.5,
    me_mj: 100,
    animal_type: 'COW' as const,
  };
  const same = { dmKg: 10, cpKg: 1.5, meMj: 100 };

  it('is not stale when nothing moved', () => {
    const res = isManualStale(snap, same, 'COW', 15);
    expect(res.stale).toBe(false);
    expect(res.drift).toEqual({ dm_pct: 0, cp_pct: 0, me_pct: 0 });
  });

  it('stays fresh at exactly the limit, stale just over it — per nutrient', () => {
    expect(isManualStale(snap, { ...same, dmKg: 11.5 }, 'COW', 15).stale).toBe(
      false,
    );
    expect(isManualStale(snap, { ...same, dmKg: 11.6 }, 'COW', 15).stale).toBe(
      true,
    );
    expect(isManualStale(snap, { ...same, cpKg: 1.8 }, 'COW', 15).stale).toBe(
      true,
    );
    expect(isManualStale(snap, { ...same, meMj: 84 }, 'COW', 15).stale).toBe(
      true,
    );
  });

  it('flags an animal-type change even with no drift', () => {
    const res = isManualStale(snap, same, 'DRY', 15);
    expect(res.stale).toBe(true);
    expect(res.animal_type_changed).toBe(true);
  });

  it('treats a zero snapshot as a full change once the need is positive', () => {
    const zero = { ...snap, dm_kg: 0 };
    expect(isManualStale(zero, same, 'COW', 15).drift.dm_pct).toBe(100);
    expect(
      isManualStale(zero, { ...same, dmKg: 0 }, 'COW', 15).drift.dm_pct,
    ).toBe(0);
  });
});

describe('requirementsFromManual — v2 profile (RAKHAL-463)', () => {
  const full = {
    dmKg: 12,
    cpKg: 1.9,
    meMj: 150,
    ndfKg: 4.4,
    ndfMaxKg: 5.2,
    adfKg: 3,
    fatKg: 0.6,
    tdnKg: 8,
    calciumKg: 0.09,
    phosphorusKg: 0.05,
    rdpPct: 60,
    rupPct: 40,
  };
  const r = requirementsFromManual(full, S);

  it('uses every stored value instead of the farm shares', () => {
    expect([r.ndfKg, r.ndfMaxKg, r.adfKg, r.fatKg, r.tdnKg]).toEqual([
      4.4, 5.2, 3, 0.6, 8,
    ]);
    expect([r.rdpPct, r.rupPct]).toEqual([60, 40]);
  });

  it('has no null in a v2 row: Ca and P are set and Ca:P is derived', () => {
    expect(r.calciumKg).toBe(0.09);
    expect(r.phosphorusKg).toBe(0.05);
    expect(r.caPRatioTarget).toBe(1.8);
    expect(r.breakdown).toBeNull(); // manual never has a component breakdown
  });

  it('does not rescale stored values when the farm settings change', () => {
    const other = requirementsFromManual(full, { ...S, tdnShareOfIntake: 0.5 });
    expect(other.tdnKg).toBe(8);
  });

  it('a v1 row (all profile fields null) resolves exactly as before', () => {
    const v1 = requirementsFromManual(
      {
        dmKg: 12,
        cpKg: 1.9,
        meMj: 150,
        ndfKg: null,
        ndfMaxKg: null,
        adfKg: null,
        fatKg: null,
        tdnKg: null,
        calciumKg: null,
        phosphorusKg: null,
        rdpPct: null,
        rupPct: null,
      },
      S,
    );
    expect(v1).toEqual(
      requirementsFromManual({ dmKg: 12, cpKg: 1.9, meMj: 150 }, S),
    );
    expect(v1.calciumKg).toBeNull();
    expect(v1.tdnKg).toBeCloseTo(S.tdnShareOfIntake * 12, 2);
    expect(v1.caPRatioTarget).toBe(S.calciumToPhosphorusTarget);
  });

  it('falls back to the farm Ca:P target when phosphorus is 0', () => {
    const z = requirementsFromManual({ ...full, phosphorusKg: 0 }, S);
    expect(z.caPRatioTarget).toBe(S.calciumToPhosphorusTarget);
  });
});

describe('validateManualValues', () => {
  const ok = { dmKg: 12, cpKg: 1.9, meMj: 150 };
  const codes = (r: { errors: { code: string }[] }) =>
    r.errors.map((e) => e.code);
  const warns = (r: { warnings: { code: string }[] }) =>
    r.warnings.map((w) => w.code);

  it('accepts a sane core-only value with no issues', () => {
    expect(validateManualValues(ok, 550)).toEqual({ errors: [], warnings: [] });
  });

  it('rejects the v1 hard bounds', () => {
    expect(codes(validateManualValues({ ...ok, dmKg: 0.4 }))).toContain(
      'dm_range',
    );
    expect(codes(validateManualValues({ ...ok, dmKg: 41 }))).toContain(
      'dm_range',
    );
    expect(codes(validateManualValues({ ...ok, cpKg: 0 }))).toContain(
      'cp_positive',
    );
    expect(codes(validateManualValues({ ...ok, cpKg: 12 }))).toContain(
      'cp_below_dm',
    );
    expect(codes(validateManualValues({ ...ok, meMj: 4 }))).toContain(
      'me_range',
    );
    expect(codes(validateManualValues({ ...ok, meMj: 401 }))).toContain(
      'me_range',
    );
  });

  it('keeps the v1 soft warnings and their codes', () => {
    const w = validateManualValues({ dmKg: 30, cpKg: 1, meMj: 500 - 100 }, 500);
    expect(warns(w)).toEqual(
      expect.arrayContaining(['dm_body_weight', 'cp_share', 'energy_density']),
    );
    expect(w.errors).toEqual([]);
  });

  it('rejects profile fields that break the hard rules', () => {
    expect(codes(validateManualValues({ ...ok, tdnKg: 0 }))).toContain(
      'positive',
    );
    expect(codes(validateManualValues({ ...ok, adfKg: 12 }))).toContain(
      'below_dm',
    );
    expect(codes(validateManualValues({ ...ok, calciumKg: -1 }))).toContain(
      'non_negative',
    );
    expect(
      codes(validateManualValues({ ...ok, calciumKg: 6, phosphorusKg: 6 })),
    ).toContain('minerals_below_dm');
    expect(
      codes(validateManualValues({ ...ok, ndfKg: 5, ndfMaxKg: 4 })),
    ).toContain('ndf_max_below_min');
    expect(codes(validateManualValues({ ...ok, rdpPct: 101 }))).toContain(
      'pct_range',
    );
  });

  it('allows zero calcium and phosphorus', () => {
    expect(
      validateManualValues({ ...ok, calciumKg: 0, phosphorusKg: 0 }).errors,
    ).toEqual([]);
  });

  it('warns, but does not reject, unusual profile figures', () => {
    const w = validateManualValues({
      ...ok,
      ndfKg: 1,
      adfKg: 9,
      fatKg: 2,
      tdnKg: 3,
      calciumKg: 0.2,
      phosphorusKg: 0.05,
      rdpPct: 70,
      rupPct: 40,
    });
    expect(w.errors).toEqual([]);
    expect(warns(w)).toEqual(
      expect.arrayContaining([
        'ndf_share',
        'adf_share',
        'fat_share',
        'tdn_share',
        'ca_p_ratio',
        'protein_split',
      ]),
    );
  });

  it('checks optional fields only when they are supplied', () => {
    expect(
      validateManualValues({ ...ok, ndfKg: null, tdnKg: undefined }).errors,
    ).toEqual([]);
  });
});
