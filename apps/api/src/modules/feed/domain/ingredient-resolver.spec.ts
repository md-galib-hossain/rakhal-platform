import {
  CatalogueIngredient,
  IngredientOverride,
  resolveEffective,
} from './ingredient-resolver';

const base: CatalogueIngredient = {
  id: 'ing_01',
  dmPct: 88,
  cpPct: 17,
  meMjPerKgDm: 11.5,
  fatPct: 4,
  ndfPct: 40,
  currentPricePerKg: 52,
};

const emptyOverride: IngredientOverride = {
  customPricePerKg: null,
  customDmPct: null,
  customCpPct: null,
  customMeMjPerKgDm: null,
  customFatPct: null,
  customNdfPct: null,
};

describe('resolveEffective', () => {
  it('falls through to Rakhal market values with no override', () => {
    const eff = resolveEffective(base);
    expect(eff.pricePerKg).toBe(52);
    expect(eff.priceSource).toBe('rakhal_market');
    expect(eff.hasNutritionOverride).toBe(false);
    expect(eff.cpPct).toBe(17);
  });

  it('uses a farm price override and flags the source', () => {
    const eff = resolveEffective(base, {
      ...emptyOverride,
      customPricePerKg: 45,
    });
    expect(eff.pricePerKg).toBe(45);
    expect(eff.priceSource).toBe('farm_override');
    expect(eff.hasNutritionOverride).toBe(false);
  });

  it('uses custom nutrition where set, standard elsewhere', () => {
    const eff = resolveEffective(base, { ...emptyOverride, customCpPct: 20 });
    expect(eff.cpPct).toBe(20);
    expect(eff.dmPct).toBe(88); // untouched
    expect(eff.hasNutritionOverride).toBe(true);
    expect(eff.priceSource).toBe('rakhal_market'); // price not overridden
  });

  it('treats a custom price of 0 as an override (not a fall-through)', () => {
    const eff = resolveEffective(base, {
      ...emptyOverride,
      customPricePerKg: 0,
    });
    expect(eff.pricePerKg).toBe(0);
    expect(eff.priceSource).toBe('farm_override');
  });
});
