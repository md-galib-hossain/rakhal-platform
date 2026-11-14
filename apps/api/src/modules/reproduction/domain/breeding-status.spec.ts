import { BreedingStatus } from '@prisma/client';
import { deriveBreedingStatus } from './breeding-status';

describe('deriveBreedingStatus', () => {
  it('returns CALVED when calving fact is true, regardless of other facts', () => {
    expect(
      deriveBreedingStatus({
        hasCalving: true,
        hasAbortion: true,
        hasActivePregnancy: true,
        hasFailedDiagnosis: true,
        hasReturnedToHeat: true,
      }),
    ).toBe(BreedingStatus.CALVED);
  });

  it('returns ABORTED when abortion fact is true and no calving', () => {
    expect(
      deriveBreedingStatus({
        hasCalving: false,
        hasAbortion: true,
        hasActivePregnancy: true,
        hasFailedDiagnosis: true,
        hasReturnedToHeat: true,
      }),
    ).toBe(BreedingStatus.ABORTED);
  });

  it('returns PREGNANT when active pregnancy and no calving/abortion', () => {
    expect(
      deriveBreedingStatus({
        hasCalving: false,
        hasAbortion: false,
        hasActivePregnancy: true,
        hasFailedDiagnosis: true,
        hasReturnedToHeat: true,
      }),
    ).toBe(BreedingStatus.PREGNANT);
  });

  it('returns FAILED when only a failed diagnosis exists', () => {
    expect(
      deriveBreedingStatus({
        hasCalving: false,
        hasAbortion: false,
        hasActivePregnancy: false,
        hasFailedDiagnosis: true,
        hasReturnedToHeat: true,
      }),
    ).toBe(BreedingStatus.FAILED);
  });

  it('returns RETURNED_TO_HEAT when only that fact exists', () => {
    expect(
      deriveBreedingStatus({
        hasCalving: false,
        hasAbortion: false,
        hasActivePregnancy: false,
        hasFailedDiagnosis: false,
        hasReturnedToHeat: true,
      }),
    ).toBe(BreedingStatus.RETURNED_TO_HEAT);
  });

  it('returns PENDING_CHECK when no downstream facts exist', () => {
    expect(
      deriveBreedingStatus({
        hasCalving: false,
        hasAbortion: false,
        hasActivePregnancy: false,
        hasFailedDiagnosis: false,
        hasReturnedToHeat: false,
      }),
    ).toBe(BreedingStatus.PENDING_CHECK);
  });
});
