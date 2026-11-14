import { resolveKgPerUnit } from './unit.service';

describe('resolveKgPerUnit', () => {
  it('uses the unit conversionToBase for a WEIGHT-dimension unit, ignoring stored kgPerUnit', () => {
    const gram = { dimension: 'WEIGHT' as const, conversionToBase: 0.001 };
    expect(resolveKgPerUnit(gram, 999)).toBe(0.001);
    expect(resolveKgPerUnit(gram, null)).toBe(0.001);
  });

  it('resolves kg itself to 1 via conversionToBase', () => {
    const kg = { dimension: 'WEIGHT' as const, conversionToBase: 1 };
    expect(resolveKgPerUnit(kg, null)).toBe(1);
  });

  it('falls back to the stored kgPerUnit for a COUNT-dimension unit', () => {
    const bag = { dimension: 'COUNT' as const, conversionToBase: null };
    expect(resolveKgPerUnit(bag, 25)).toBe(25);
    expect(resolveKgPerUnit(bag, null)).toBeNull();
  });

  it('falls back to the stored kgPerUnit for a VOLUME-dimension unit', () => {
    const litre = { dimension: 'VOLUME' as const, conversionToBase: 1 };
    expect(resolveKgPerUnit(litre, 1.03)).toBe(1.03);
    expect(resolveKgPerUnit(litre, null)).toBeNull();
  });
});
