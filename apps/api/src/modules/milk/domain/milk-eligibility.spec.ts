import { deriveMilkEligibility } from './milk-eligibility';

describe('deriveMilkEligibility', () => {
  it('is SALEABLE with no reasons when nothing applies', () => {
    const result = deriveMilkEligibility({
      isWithheld: false,
      isInColostrumWindow: false,
      hasDiscardRequiredHold: false,
    });
    expect(result).toEqual({
      isSaleable: true,
      primaryStatus: 'SALEABLE',
      reasons: [],
    });
  });

  it('is WITHHELD with MEDICINE_WITHDRAWAL only', () => {
    const result = deriveMilkEligibility({
      isWithheld: true,
      isInColostrumWindow: false,
      hasDiscardRequiredHold: false,
    });
    expect(result).toEqual({
      isSaleable: false,
      primaryStatus: 'WITHHELD',
      reasons: ['MEDICINE_WITHDRAWAL'],
    });
  });

  it('is COLOSTRUM with COLOSTRUM_PERIOD only', () => {
    const result = deriveMilkEligibility({
      isWithheld: false,
      isInColostrumWindow: true,
      hasDiscardRequiredHold: false,
    });
    expect(result).toEqual({
      isSaleable: false,
      primaryStatus: 'COLOSTRUM',
      reasons: ['COLOSTRUM_PERIOD'],
    });
  });

  it('is DISCARD_REQUIRED with OTHER only', () => {
    const result = deriveMilkEligibility({
      isWithheld: false,
      isInColostrumWindow: false,
      hasDiscardRequiredHold: true,
    });
    expect(result).toEqual({
      isSaleable: false,
      primaryStatus: 'DISCARD_REQUIRED',
      reasons: ['OTHER'],
    });
  });

  it('is WITHHELD (wins over COLOSTRUM) but keeps both reasons — the v2 multi-reason case', () => {
    const result = deriveMilkEligibility({
      isWithheld: true,
      isInColostrumWindow: true,
      hasDiscardRequiredHold: false,
    });
    expect(result).toEqual({
      isSaleable: false,
      primaryStatus: 'WITHHELD',
      reasons: ['MEDICINE_WITHDRAWAL', 'COLOSTRUM_PERIOD'],
    });
  });

  it('DISCARD_REQUIRED always wins over WITHHELD, keeping both reasons', () => {
    const result = deriveMilkEligibility({
      isWithheld: true,
      isInColostrumWindow: false,
      hasDiscardRequiredHold: true,
    });
    expect(result).toEqual({
      isSaleable: false,
      primaryStatus: 'DISCARD_REQUIRED',
      reasons: ['OTHER', 'MEDICINE_WITHDRAWAL'],
    });
  });

  it('DISCARD_REQUIRED always wins over COLOSTRUM, keeping both reasons', () => {
    const result = deriveMilkEligibility({
      isWithheld: false,
      isInColostrumWindow: true,
      hasDiscardRequiredHold: true,
    });
    expect(result).toEqual({
      isSaleable: false,
      primaryStatus: 'DISCARD_REQUIRED',
      reasons: ['OTHER', 'COLOSTRUM_PERIOD'],
    });
  });

  it('DISCARD_REQUIRED wins over everything when all three apply, all three reasons present', () => {
    const result = deriveMilkEligibility({
      isWithheld: true,
      isInColostrumWindow: true,
      hasDiscardRequiredHold: true,
    });
    expect(result).toEqual({
      isSaleable: false,
      primaryStatus: 'DISCARD_REQUIRED',
      reasons: ['OTHER', 'MEDICINE_WITHDRAWAL', 'COLOSTRUM_PERIOD'],
    });
  });
});
