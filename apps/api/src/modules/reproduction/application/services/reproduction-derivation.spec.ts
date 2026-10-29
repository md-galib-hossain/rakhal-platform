import {
  BreedingStatus,
  CattleGender,
  ReproductionState,
} from '@prisma/client';
import { deriveReproductionState } from './reproduction-derivation.service';

const now = new Date('2026-10-29T00:00:00.000Z');
const born = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86400000);

const base = {
  now,
  gender: CattleGender.FEMALE,
  hasBreedingHistory: false,
  hasActivePregnancy: false,
  lastBreeding: null as { status: BreedingStatus } | null,
  lastCalving: null,
  vwpDays: 60,
};

describe('deriveReproductionState — breeding age (RAKHAL-476)', () => {
  it('defaults to 450 days when no farm value is passed', () => {
    expect(deriveReproductionState({ ...base, dateOfBirth: born(400) })).toBe(
      ReproductionState.NOT_ELIGIBLE,
    );
    expect(deriveReproductionState({ ...base, dateOfBirth: born(500) })).toBe(
      ReproductionState.OPEN,
    );
  });

  it('reads the farm breeding-age setting', () => {
    expect(
      deriveReproductionState({
        ...base,
        dateOfBirth: born(400),
        breedingAgeDays: 365,
      }),
    ).toBe(ReproductionState.OPEN);
    expect(
      deriveReproductionState({
        ...base,
        dateOfBirth: born(500),
        breedingAgeDays: 600,
      }),
    ).toBe(ReproductionState.NOT_ELIGIBLE);
  });
});
