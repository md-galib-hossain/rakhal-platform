import {
  blendNutrition,
  diffNutrition,
  moisturePctFromDm,
  NutritionValues,
  toNutritionValues,
  validateNutrition,
} from './nutrition-profile';

const hay = (): NutritionValues =>
  toNutritionValues({
    dmPct: 88,
    cpPct: 9,
    meMjPerKgDm: 8.5,
    ndfPct: 65,
    adfPct: 40,
    calciumPct: 0.4,
    phosphorusPct: 0.2,
  });

describe('validateNutrition', () => {
  it('accepts a sensible profile and leaves unmeasured optionals as null', () => {
    const v = hay();
    expect(validateNutrition(v)).toEqual([]);
    expect(v.fatPct).toBeNull();
    expect(v.tdnPct).toBeNull();
  });

  it('accepts a mineral feed with ME 0 and CP 0', () => {
    const v = toNutritionValues({
      dmPct: 98,
      cpPct: 0,
      meMjPerKgDm: 0,
      calciumPct: 24,
      phosphorusPct: 12,
    });
    expect(validateNutrition(v)).toEqual([]);
  });

  it('rejects the CP 200 typo', () => {
    expect(validateNutrition({ ...hay(), cpPct: 200 })).toContain(
      'cpPct must be between 0 and 100',
    );
  });

  it('rejects dm 0 and dm above 100', () => {
    expect(validateNutrition({ ...hay(), dmPct: 0 })[0]).toMatch(/dmPct/);
    expect(validateNutrition({ ...hay(), dmPct: 101 })[0]).toMatch(/dmPct/);
  });

  it('rejects ME given in kJ instead of MJ', () => {
    expect(validateNutrition({ ...hay(), meMjPerKgDm: 8500 })[0]).toMatch(
      /meMjPerKgDm/,
    );
  });

  it('rejects NDF below ADF', () => {
    const v = { ...hay(), ndfPct: 30, adfPct: 40 };
    expect(validateNutrition(v).join()).toMatch(
      /ndfPct must be at least adfPct/,
    );
  });

  it('rejects CP + fat + NDF + starch beyond 100% of DM', () => {
    const v = { ...hay(), cpPct: 40, fatPct: 15, ndfPct: 55, adfPct: null };
    expect(validateNutrition(v).join()).toMatch(
      /cannot exceed 100% of dry matter/,
    );
  });

  it('rejects NaN and treats null as not-measured, not as an error', () => {
    expect(validateNutrition({ ...hay(), cpPct: Number.NaN })[0]).toMatch(
      /must be a number/,
    );
    expect(validateNutrition({ ...hay(), fatPct: null })).toEqual([]);
  });

  it('rejects rdp + rup over 100 and Ca + P over 100', () => {
    expect(
      validateNutrition({ ...hay(), rdpPct: 80, rupPct: 40 }).join(),
    ).toMatch(/rdpPct \+ rupPct/);
    expect(
      validateNutrition({ ...hay(), calciumPct: 70, phosphorusPct: 40 }).join(),
    ).toMatch(/calciumPct \+ phosphorusPct/);
  });
});

describe('diffNutrition', () => {
  it('reports only changed keys and separates null from 0', () => {
    const a = hay();
    const b = { ...hay(), cpPct: 12, fatPct: 0 };
    expect(diffNutrition(a, b).sort()).toEqual(['cpPct', 'fatPct']);
    expect(diffNutrition(a, hay())).toEqual([]);
  });
});

describe('blendNutrition', () => {
  it('returns the single lot unchanged', () => {
    expect(blendNutrition([{ kg: 5, values: hay() }])).toEqual(hay());
  });

  it('weights dm by fresh kg and other nutrients by dm kg', () => {
    const wet = { ...hay(), dmPct: 40, cpPct: 10 };
    const dry = { ...hay(), dmPct: 90, cpPct: 20 };
    const out = blendNutrition([
      { kg: 10, values: wet },
      { kg: 10, values: dry },
    ]);
    expect(out.dmPct).toBe(65);
    // dm kg: 4 vs 9 -> cp = (10*4 + 20*9) / 13
    expect(out.cpPct).toBeCloseTo(16.9231, 3);
  });

  it('keeps a nutrient null when any lot did not measure it, and ignores zero-kg parts', () => {
    const measured = { ...hay(), fatPct: 3 };
    const out = blendNutrition([
      { kg: 4, values: measured },
      { kg: 4, values: { ...hay(), fatPct: null } },
      { kg: 0, values: { ...hay(), cpPct: 50 } },
    ]);
    expect(out.fatPct).toBeNull();
    expect(out.cpPct).toBe(hay().cpPct);
  });
});

describe('moisturePctFromDm', () => {
  it('derives moisture as 100 minus DM', () => {
    expect(moisturePctFromDm(35)).toBe(65);
    expect(moisturePctFromDm(88.5)).toBe(11.5);
  });
});
