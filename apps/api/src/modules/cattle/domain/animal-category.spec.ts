import {
  DEFAULT_WEANING_DAYS,
  DAY_MS,
} from 'src/modules/calf/domain/calf-stage';
import { deriveAnimalCategory } from './animal-category';

describe('deriveAnimalCategory', () => {
  const now = new Date('2026-03-01T00:00:00Z');

  const dobDaysAgo = (days: number) => new Date(now.getTime() - days * DAY_MS);

  it('classifies a female calf below the weaning threshold as CALF regardless of calvings', () => {
    expect(
      deriveAnimalCategory({
        gender: 'FEMALE',
        dateOfBirth: dobDaysAgo(DEFAULT_WEANING_DAYS - 1),
        totalCalvings: 0,
        now,
      }),
    ).toBe('CALF');
  });

  it('classifies a male calf below the weaning threshold as CALF', () => {
    expect(
      deriveAnimalCategory({
        gender: 'MALE',
        dateOfBirth: dobDaysAgo(1),
        totalCalvings: 0,
        now,
      }),
    ).toBe('CALF');
  });

  it('classifies a castrated-male calf below the weaning threshold as CALF', () => {
    expect(
      deriveAnimalCategory({
        gender: 'CASTRATED_MALE',
        dateOfBirth: dobDaysAgo(0),
        totalCalvings: 0,
        now,
      }),
    ).toBe('CALF');
  });

  it('is exactly CALF at DEFAULT_WEANING_DAYS - 1 and no longer CALF at DEFAULT_WEANING_DAYS', () => {
    expect(
      deriveAnimalCategory({
        gender: 'FEMALE',
        dateOfBirth: dobDaysAgo(DEFAULT_WEANING_DAYS - 1),
        totalCalvings: 0,
        now,
      }),
    ).toBe('CALF');

    expect(
      deriveAnimalCategory({
        gender: 'FEMALE',
        dateOfBirth: dobDaysAgo(DEFAULT_WEANING_DAYS),
        totalCalvings: 0,
        now,
      }),
    ).toBe('HEIFER');
  });

  it('classifies a weaned female with zero calvings as HEIFER', () => {
    expect(
      deriveAnimalCategory({
        gender: 'FEMALE',
        dateOfBirth: dobDaysAgo(DEFAULT_WEANING_DAYS + 365),
        totalCalvings: 0,
        now,
      }),
    ).toBe('HEIFER');
  });

  it('classifies a weaned female with 1+ calvings as COW', () => {
    expect(
      deriveAnimalCategory({
        gender: 'FEMALE',
        dateOfBirth: dobDaysAgo(DEFAULT_WEANING_DAYS + 365),
        totalCalvings: 1,
        now,
      }),
    ).toBe('COW');

    expect(
      deriveAnimalCategory({
        gender: 'FEMALE',
        dateOfBirth: dobDaysAgo(DEFAULT_WEANING_DAYS + 365 * 3),
        totalCalvings: 4,
        now,
      }),
    ).toBe('COW');
  });

  it('classifies a weaned male as BULL', () => {
    expect(
      deriveAnimalCategory({
        gender: 'MALE',
        dateOfBirth: dobDaysAgo(DEFAULT_WEANING_DAYS + 30),
        totalCalvings: 0,
        now,
      }),
    ).toBe('BULL');
  });

  it('classifies a weaned castrated male as STEER', () => {
    expect(
      deriveAnimalCategory({
        gender: 'CASTRATED_MALE',
        dateOfBirth: dobDaysAgo(DEFAULT_WEANING_DAYS + 30),
        totalCalvings: 0,
        now,
      }),
    ).toBe('STEER');
  });

  it('falls through to gender/calving rules when dateOfBirth is unknown (null)', () => {
    expect(
      deriveAnimalCategory({
        gender: 'FEMALE',
        dateOfBirth: null,
        totalCalvings: 0,
        now,
      }),
    ).toBe('HEIFER');

    expect(
      deriveAnimalCategory({
        gender: 'FEMALE',
        dateOfBirth: null,
        totalCalvings: 2,
        now,
      }),
    ).toBe('COW');

    expect(
      deriveAnimalCategory({
        gender: 'MALE',
        dateOfBirth: null,
        totalCalvings: 0,
        now,
      }),
    ).toBe('BULL');

    expect(
      deriveAnimalCategory({
        gender: 'CASTRATED_MALE',
        dateOfBirth: null,
        totalCalvings: 0,
        now,
      }),
    ).toBe('STEER');
  });

  it('defaults now to the current time when omitted', () => {
    const result = deriveAnimalCategory({
      gender: 'MALE',
      dateOfBirth: null,
      totalCalvings: 0,
    });
    expect(result).toBe('BULL');
  });
});
