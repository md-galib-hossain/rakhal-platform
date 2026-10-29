import { deriveAnimalCategory } from './animal-category';

const now = new Date('2026-10-29T00:00:00.000Z');
const born = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86400000);

describe('deriveAnimalCategory — farm weaning days (RAKHAL-477)', () => {
  const base = { gender: 'FEMALE' as const, totalCalvings: 0, now };

  it('uses the default weaning days (60) when none is passed', () => {
    expect(deriveAnimalCategory({ ...base, dateOfBirth: born(50) })).toBe(
      'CALF',
    );
    expect(deriveAnimalCategory({ ...base, dateOfBirth: born(70) })).toBe(
      'HEIFER',
    );
  });

  it('uses the farm weaning days when passed', () => {
    expect(
      deriveAnimalCategory({ ...base, dateOfBirth: born(70), weaningDays: 90 }),
    ).toBe('CALF');
    expect(
      deriveAnimalCategory({ ...base, dateOfBirth: born(50), weaningDays: 30 }),
    ).toBe('HEIFER');
  });
});
