import { NutritionValues } from './nutrition-profile';
import { FitBands } from './program-fit';
import {
  buildNutrientRows,
  computeNutrientSupply,
  PlanRequirement,
} from './plan-nutrition';

const bands: FitBands = {
  dmBelowPct: 10,
  dmAbovePct: 10,
  cpBelowPct: 10,
  cpAbovePct: 20,
  meBelowPct: 10,
  meAbovePct: 10,
};

const profile = (over: Partial<NutritionValues> = {}): NutritionValues => ({
  dmPct: 90,
  cpPct: 20,
  meMjPerKgDm: 12,
  fatPct: 4,
  ndfPct: 30,
  adfPct: 20,
  rdpPct: 60,
  rupPct: 40,
  starchPct: 10,
  sugarsPct: null,
  calciumPct: 1,
  phosphorusPct: 0.5,
  tdnPct: 70,
  ...over,
});

const req: PlanRequirement = {
  dm_kg: 9,
  cp_kg: 1.8,
  me_mj: 108,
  fat_kg: 0.36,
  ndf_kg: 2.7,
  ndf_max_kg: 3.6,
  adf_kg: 1.8,
  tdn_kg: 6.3,
  calcium_kg: 0.09,
  phosphorus_kg: 0.045,
  rdp_pct: 60,
  rup_pct: 40,
  ca_p_ratio_target: 2,
};

const rowOf = (rows: ReturnType<typeof buildNutrientRows>, key: string) => {
  const r = rows.find((x) => x.key === key);
  if (!r) throw new Error(`no row ${key}`);
  return r;
};

describe('computeNutrientSupply', () => {
  it('derives every nutrient from as-fed kg × DM% (RDP/RUP from CP)', () => {
    const s = computeNutrientSupply([{ kgPerDay: 10, profile: profile() }]);
    expect(s.dm.value).toBeCloseTo(9);
    expect(s.cp.value).toBeCloseTo(1.8);
    expect(s.me.value).toBeCloseTo(108);
    expect(s.fat.value).toBeCloseTo(0.36);
    expect(s.ndf.value).toBeCloseTo(2.7);
    expect(s.calcium.value).toBeCloseTo(0.09);
    expect(s.tdn.value).toBeCloseTo(6.3);
    expect(s.rdp.value).toBeCloseTo(1.08);
    expect(s.rup.value).toBeCloseTo(0.72);
    expect(Object.values(s).every((v) => v.measured)).toBe(true);
  });

  it('marks a nutrient unmeasured — not zero — when a fed line lacks it', () => {
    const s = computeNutrientSupply([
      { kgPerDay: 5, profile: profile() },
      { kgPerDay: 5, profile: profile({ ndfPct: null }) },
    ]);
    expect(s.ndf.measured).toBe(false);
    expect(s.ndf.value).toBeCloseTo(1.35); // only the measured line counts: a floor
    expect(s.fat.measured).toBe(true);
  });

  it('marks everything unmeasured for a line with no lot, and ignores 0-kg lines', () => {
    const s = computeNutrientSupply([
      { kgPerDay: 5, profile: null },
      { kgPerDay: 0, profile: null },
    ]);
    expect(s.dm.measured).toBe(false);
    expect(
      computeNutrientSupply([{ kgPerDay: 0, profile: null }]).dm.measured,
    ).toBe(true);
  });
});

describe('buildNutrientRows', () => {
  const full = computeNutrientSupply([{ kgPerDay: 10, profile: profile() }]);

  it('returns every nutrient row, with a requirement for all but starch', () => {
    const rows = buildNutrientRows(full, req, bands);
    expect(rows.map((r) => r.key)).toEqual([
      'dm',
      'cp',
      'me',
      'fat',
      'ndf',
      'adf',
      'tdn',
      'calcium',
      'phosphorus',
      'ca_p_ratio',
      'rdp_pct',
      'rup_pct',
      'starch',
    ]);
    expect(rowOf(rows, 'starch').requirement).toBeNull();
    expect(
      rows.filter((r) => r.key !== 'starch').every((r) => r.severity === 'ok'),
    ).toBe(true);
  });

  it('judges dm/cp/me with the farm bands and the rest with the default tolerance', () => {
    const rows = buildNutrientRows(
      computeNutrientSupply([{ kgPerDay: 20, profile: profile() }]), // double everything
      req,
      bands,
    );
    expect(rowOf(rows, 'dm')).toMatchObject({
      delta_pct: 100,
      severity: 'bad',
    });
    expect(rowOf(rows, 'fat').severity).toBe('bad');
    // ratio and % of CP do not change when the whole ration doubles
    expect(rowOf(rows, 'ca_p_ratio')).toMatchObject({
      supply: 2,
      severity: 'ok',
    });
    expect(rowOf(rows, 'rdp_pct')).toMatchObject({
      supply: 60,
      severity: 'ok',
    });
  });

  it('treats NDF and ADF as minimums but warns above the NDF ceiling', () => {
    const rows = buildNutrientRows(
      computeNutrientSupply([{ kgPerDay: 14, profile: profile() }]), // ndf 3.78 > max 3.6, > min
      req,
      bands,
    );
    expect(rowOf(rows, 'ndf')).toMatchObject({ max: 3.6, severity: 'warn' });
    expect(rowOf(rows, 'adf').severity).toBe('ok'); // over a minimum is fine
  });

  it('never judges an unmeasured nutrient', () => {
    const s = computeNutrientSupply([
      { kgPerDay: 10, profile: profile({ calciumPct: null }) },
    ]);
    const rows = buildNutrientRows(s, req, bands);
    expect(rowOf(rows, 'calcium')).toMatchObject({
      measured: false,
      severity: 'unknown',
    });
    expect(rowOf(rows, 'ca_p_ratio')).toMatchObject({
      measured: false,
      severity: 'unknown',
    });
    expect(rowOf(rows, 'dm').severity).toBe('ok');
  });

  it('shows a null supply for the ratio when no phosphorus is supplied', () => {
    const s = computeNutrientSupply([
      { kgPerDay: 10, profile: profile({ phosphorusPct: 0 }) },
    ]);
    expect(
      rowOf(buildNutrientRows(s, req, bands), 'ca_p_ratio').supply,
    ).toBeNull();
  });
});
