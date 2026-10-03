import { convertQuantity, unitsCompatible, UnitLike } from './unit-conversion';

const kg: UnitLike = {
  id: 'kg',
  symbol: 'kg',
  dimension: 'WEIGHT',
  conversionToBase: 1,
};
const g: UnitLike = {
  id: 'g',
  symbol: 'g',
  dimension: 'WEIGHT',
  conversionToBase: 0.001,
};
const l: UnitLike = {
  id: 'l',
  symbol: 'L',
  dimension: 'VOLUME',
  conversionToBase: 1,
};
const ml: UnitLike = {
  id: 'ml',
  symbol: 'mL',
  dimension: 'VOLUME',
  conversionToBase: 0.001,
};
const bottle: UnitLike = {
  id: 'bottle',
  symbol: 'bottle',
  dimension: 'COUNT',
  conversionToBase: null,
};
const dose: UnitLike = {
  id: 'dose',
  symbol: 'dose',
  dimension: 'COUNT',
  conversionToBase: null,
};

describe('unit-conversion', () => {
  it('converts within weight and volume', () => {
    expect(convertQuantity(500, g, kg)).toBe(0.5);
    expect(convertQuantity(2, kg, g)).toBe(2000);
    expect(convertQuantity(250, ml, l)).toBe(0.25);
  });

  it('returns same quantity for the same unit', () => {
    expect(convertQuantity(3, bottle, bottle)).toBe(3);
  });

  it('refuses cross-dimension and cross-count conversion', () => {
    expect(unitsCompatible(g, ml)).toBe(false);
    expect(unitsCompatible(bottle, dose)).toBe(false);
    expect(() => convertQuantity(1, g, ml)).toThrow();
    expect(() => convertQuantity(1, bottle, dose)).toThrow();
  });
});
