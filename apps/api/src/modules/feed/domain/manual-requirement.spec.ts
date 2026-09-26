import { isManualStale, requirementsFromManual } from './manual-requirement';
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
