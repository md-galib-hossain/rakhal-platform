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
  rdpPct: null,
  rupPct: null,
  starchPct: null,
  adfPct: null,
  calciumPct: null,
  phosphorusPct: null,
  tdnPct: null,
  currentPricePerKg: 52,
};

const emptyOverride: IngredientOverride = {
  customPricePerKg: null,
  customDmPct: null,
  customCpPct: null,
  customMeMjPerKgDm: null,
  customFatPct: null,
  customNdfPct: null,
  customRdpPct: null,
  customRupPct: null,
  customStarchPct: null,
  customAdfPct: null,
  customCalciumPct: null,
  customPhosphorusPct: null,
  customTdnPct: null,
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

  it('defaults nutritionSource to REFERENCE when neither side states one', () => {
    const eff = resolveEffective(base, emptyOverride);
    expect(eff.nutritionSource).toBe('REFERENCE');
  });

  it("prefers the override's LAB source over the catalogue's REFERENCE default", () => {
    const eff = resolveEffective(base, {
      ...emptyOverride,
      nutritionSource: 'LAB',
    });
    expect(eff.nutritionSource).toBe('LAB');
  });

  it("never lets an unset override outrank the catalogue's own LAB source", () => {
    const eff = resolveEffective(
      { ...base, nutritionSource: 'LAB' },
      emptyOverride,
    );
    expect(eff.nutritionSource).toBe('LAB');
  });

  it("keeps the catalogue's higher-ranked LAB source over an override's lower-ranked FARM_ESTIMATE", () => {
    const eff = resolveEffective(
      { ...base, nutritionSource: 'LAB' },
      { ...emptyOverride, nutritionSource: 'FARM_ESTIMATE' },
    );
    expect(eff.nutritionSource).toBe('LAB');
  });
});
