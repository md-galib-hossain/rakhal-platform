import {
  LIFECYCLE_BANDS,
  deriveLifecycleSubStage,
  buildLifecycleSubStageWhere,
} from './lifecycle-bands';
import { deriveAnimalCategory } from './animal-category';

function daysAgo(days: number, now: Date): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

describe('lifecycle-bands', () => {
  const now = new Date('2026-01-01T00:00:00Z');

  it('derives null for a CALF (below the weaning band)', () => {
    expect(
      deriveLifecycleSubStage({
        gender: 'FEMALE',
        dateOfBirth: daysAgo(30, now),
        totalCalvings: 0,
        now,
      }),
    ).toBeNull();
  });

  it('derives WEANED_HEIFER for a 90-day female with no calvings', () => {
    expect(
      deriveLifecycleSubStage({
        gender: 'FEMALE',
        dateOfBirth: daysAgo(90, now),
        totalCalvings: 0,
        now,
      }),
    ).toBe('WEANED_HEIFER');
  });

  it('derives GROWING_HEIFER for a 200-day heifer', () => {
    expect(
      deriveLifecycleSubStage({
        gender: 'FEMALE',
        dateOfBirth: daysAgo(200, now),
        totalCalvings: 0,
        now,
      }),
    ).toBe('GROWING_HEIFER');
  });

  it('derives BREEDING_HEIFER for a 400-day heifer', () => {
    expect(
      deriveLifecycleSubStage({
        gender: 'FEMALE',
        dateOfBirth: daysAgo(400, now),
        totalCalvings: 0,
        now,
      }),
    ).toBe('BREEDING_HEIFER');
  });

  it('never uses a heifer term for males — WEANER_BULL at 90 days', () => {
    expect(
      deriveLifecycleSubStage({
        gender: 'MALE',
        dateOfBirth: daysAgo(90, now),
        totalCalvings: 0,
        now,
      }),
    ).toBe('WEANER_BULL');
  });

  it('derives MATURE_BULL for a 400-day male', () => {
    expect(
      deriveLifecycleSubStage({
        gender: 'MALE',
        dateOfBirth: daysAgo(400, now),
        totalCalvings: 0,
        now,
      }),
    ).toBe('MATURE_BULL');
  });

  it('derives null for a COW (calved female) — no band defined', () => {
    expect(
      deriveLifecycleSubStage({
        gender: 'FEMALE',
        dateOfBirth: daysAgo(400, now),
        totalCalvings: 1,
        now,
      }),
    ).toBeNull();
  });

  it('derives null for a STEER — no band defined', () => {
    expect(
      deriveLifecycleSubStage({
        gender: 'CASTRATED_MALE',
        dateOfBirth: daysAgo(400, now),
        totalCalvings: 0,
        now,
      }),
    ).toBeNull();
  });

  it('derives null when dateOfBirth is unknown', () => {
    expect(
      deriveLifecycleSubStage({
        gender: 'FEMALE',
        dateOfBirth: null,
        totalCalvings: 0,
        now,
      }),
    ).toBeNull();
  });

  it('buildLifecycleSubStageWhere throws on an unknown sub-stage', () => {
    expect(() => buildLifecycleSubStageWhere('NOT_A_STAGE', now)).toThrow();
  });

  it('buildLifecycleSubStageWhere matches exactly what deriveLifecycleSubStage derives (property check over every band)', () => {
    for (const band of LIFECYCLE_BANDS) {
      const gender = band.category === 'HEIFER' ? 'FEMALE' : 'MALE';
      const ageDays = band.minDays + 5;
      const dateOfBirth = daysAgo(ageDays, now);

      const derivedCategory = deriveAnimalCategory({
        gender,
        dateOfBirth,
        totalCalvings: 0,
        now,
      });
      expect(derivedCategory).toBe(band.category);

      const derivedSubStage = deriveLifecycleSubStage({
        gender,
        dateOfBirth,
        totalCalvings: 0,
        now,
      });
      expect(derivedSubStage).toBe(band.subStage);

      const where = buildLifecycleSubStageWhere(band.subStage, now);
      expect(where).toBeTruthy();
    }
  });
});
