import {
  DEFAULT_REQUIREMENT_SETTINGS,
  mergeSettings,
  parseSettings,
  REQUIREMENT_SETTING_FIELDS,
  RequirementSettings,
  validateSettings,
} from './requirement-settings';
import { computeRequirements } from './requirements';

describe('requirement settings', () => {
  describe('mergeSettings', () => {
    it('returns the base untouched when there are no changes', () => {
      expect(mergeSettings(DEFAULT_REQUIREMENT_SETTINGS, null)).toEqual(
        DEFAULT_REQUIREMENT_SETTINGS,
      );
      expect(mergeSettings(DEFAULT_REQUIREMENT_SETTINGS, {})).toEqual(
        DEFAULT_REQUIREMENT_SETTINGS,
      );
    });

    it('applies only the fields present in the change set', () => {
      const merged = mergeSettings(DEFAULT_REQUIREMENT_SETTINGS, {
        proteinPerLitreMilk: 90,
      });
      expect(merged.proteinPerLitreMilk).toBe(90);
      expect(merged.energyPerLitreMilk).toBe(
        DEFAULT_REQUIREMENT_SETTINGS.energyPerLitreMilk,
      );
    });

    it('does not mutate the base, including its nested stage table', () => {
      const merged = mergeSettings(DEFAULT_REQUIREMENT_SETTINGS, {
        pregnancyIntakeStages: [{ untilDay: 100, percentOfBodyWeight: 0.03 }],
      });
      expect(merged.pregnancyIntakeStages).toHaveLength(1);
      expect(DEFAULT_REQUIREMENT_SETTINGS.pregnancyIntakeStages).toHaveLength(
        4,
      );
      expect(
        DEFAULT_REQUIREMENT_SETTINGS.pregnancyIntakeStages[0].untilDay,
      ).toBe(90);
    });

    it('replaces the stage table whole rather than merging element-wise', () => {
      const merged = mergeSettings(DEFAULT_REQUIREMENT_SETTINGS, {
        pregnancyIntakeStages: [
          { untilDay: 150, percentOfBodyWeight: 0.02 },
          { untilDay: 280, percentOfBodyWeight: 0.025 },
        ],
      });
      expect(merged.pregnancyIntakeStages).toEqual([
        { untilDay: 150, percentOfBodyWeight: 0.02 },
        { untilDay: 280, percentOfBodyWeight: 0.025 },
      ]);
    });

    it('ignores unknown fields instead of throwing', () => {
      const merged = mergeSettings(DEFAULT_REQUIREMENT_SETTINGS, {
        someFutureCoefficient: 1.23,
      } as unknown as Partial<RequirementSettings>);
      expect(merged).toEqual(DEFAULT_REQUIREMENT_SETTINGS);
    });
  });

  describe('validateSettings', () => {
    it('accepts an empty change set and the full defaults', () => {
      expect(validateSettings({})).toEqual([]);
      expect(validateSettings(DEFAULT_REQUIREMENT_SETTINGS)).toEqual([]);
    });

    it('rejects a value outside its declared bounds', () => {
      const issues = validateSettings({ proteinPerLitreMilk: 5000 });
      expect(issues).toHaveLength(1);
      expect(issues[0].field).toBe('proteinPerLitreMilk');
      expect(issues[0].message).toContain('between');
    });

    it('rejects a negative value on a field whose minimum is above zero', () => {
      expect(validateSettings({ targetBodyCondition: -1 })).toEqual([
        expect.objectContaining({ field: 'targetBodyCondition' }),
      ]);
    });

    it('rejects a non-numeric value', () => {
      expect(validateSettings({ tdnShareOfIntake: '0.7' })).toEqual([
        { field: 'tdnShareOfIntake', message: 'must be a number' },
      ]);
    });

    it('names an unknown field rather than silently dropping it', () => {
      expect(validateSettings({ dmiFcmCoef: 0.4 })).toEqual([
        { field: 'dmiFcmCoef', message: 'is not a requirement setting' },
      ]);
    });

    it('reports every problem at once so a form can mark all bad fields', () => {
      const issues = validateSettings({
        proteinPerLitreMilk: 5000,
        targetBodyCondition: 99,
        nonsense: 1,
      });
      expect(issues.map((i) => i.field).sort()).toEqual([
        'nonsense',
        'proteinPerLitreMilk',
        'targetBodyCondition',
      ]);
    });

    it('rejects a non-object payload', () => {
      expect(validateSettings(null)).toHaveLength(1);
      expect(validateSettings([])).toHaveLength(1);
      expect(validateSettings('nope')).toHaveLength(1);
    });

    describe('pregnancy stage table', () => {
      it('rejects an empty table', () => {
        expect(validateSettings({ pregnancyIntakeStages: [] })).toEqual([
          {
            field: 'pregnancyIntakeStages',
            message: 'must have at least one stage',
          },
        ]);
      });

      it('rejects stages that are not ordered by ascending day', () => {
        const issues = validateSettings({
          pregnancyIntakeStages: [
            { untilDay: 200, percentOfBodyWeight: 0.02 },
            { untilDay: 100, percentOfBodyWeight: 0.021 },
          ],
        });
        expect(issues).toEqual([
          {
            field: 'pregnancyIntakeStages[1].untilDay',
            message: 'stages must be ordered by ascending day',
          },
        ]);
      });

      it('rejects an out-of-range body-weight fraction', () => {
        const issues = validateSettings({
          pregnancyIntakeStages: [{ untilDay: 90, percentOfBodyWeight: 2 }],
        });
        expect(issues).toEqual([
          expect.objectContaining({
            field: 'pregnancyIntakeStages[0].percentOfBodyWeight',
          }),
        ]);
      });
    });
  });

  describe('parseSettings', () => {
    it('falls back to the defaults for a malformed payload', () => {
      expect(parseSettings(null)).toEqual(DEFAULT_REQUIREMENT_SETTINGS);
      expect(parseSettings('broken')).toEqual(DEFAULT_REQUIREMENT_SETTINGS);
    });

    it('keeps valid fields and drops invalid ones rather than throwing', () => {
      const parsed = parseSettings({
        proteinPerLitreMilk: 90,
        tdnShareOfIntake: 999,
        unknownField: 1,
      });
      expect(parsed.proteinPerLitreMilk).toBe(90);
      expect(parsed.tdnShareOfIntake).toBe(
        DEFAULT_REQUIREMENT_SETTINGS.tdnShareOfIntake,
      );
    });
  });

  describe('field metadata', () => {
    it('describes every scalar setting exactly once', () => {
      const scalars = Object.keys(DEFAULT_REQUIREMENT_SETTINGS).filter(
        (k) => k !== 'pregnancyIntakeStages',
      );
      expect(Object.keys(REQUIREMENT_SETTING_FIELDS).sort()).toEqual(
        scalars.sort(),
      );
    });

    it('gives every default a value inside its own declared bounds', () => {
      for (const [field, spec] of Object.entries(REQUIREMENT_SETTING_FIELDS)) {
        const value = (
          DEFAULT_REQUIREMENT_SETTINGS as unknown as Record<string, number>
        )[field];
        expect({
          field,
          value,
          withinBounds: value >= spec.min && value <= spec.max,
        }).toEqual({ field, value, withinBounds: true });
      }
    });

    it('assigns every field a group, label and usable bounds', () => {
      for (const spec of Object.values(REQUIREMENT_SETTING_FIELDS)) {
        expect(spec.group).toBeTruthy();
        expect(spec.label).toBeTruthy();
        expect(spec.min).toBeLessThan(spec.max);
      }
    });
  });

  describe('effect on computeRequirements', () => {
    const cow = {
      weightKg: 450,
      milkTargetL: 15,
      gestationDays: 120,
      dim: 100,
    };

    it('matches the implicit defaults when the defaults are passed explicitly', () => {
      expect(computeRequirements(cow, DEFAULT_REQUIREMENT_SETTINGS)).toEqual(
        computeRequirements(cow),
      );
    });

    it('moves crude protein when the per-litre protein setting changes', () => {
      const base = computeRequirements(cow);
      const tuned = computeRequirements(
        cow,
        mergeSettings(DEFAULT_REQUIREMENT_SETTINGS, {
          proteinPerLitreMilk: 90,
        }),
      );
      // +5 g/L across 15 L = +0.075 kg/day
      expect(tuned.cpKg).toBeCloseTo(base.cpKg + 0.075, 2);
      expect(tuned.meMj).toBe(base.meMj);
    });

    it('moves dry-matter intake when the intake curve changes', () => {
      const base = computeRequirements(cow);
      const tuned = computeRequirements(
        cow,
        mergeSettings(DEFAULT_REQUIREMENT_SETTINGS, {
          intakeFromMilkFactor: 0.5,
        }),
      );
      expect(tuned.dmKg).toBeGreaterThan(base.dmKg);
    });

    it('reports the configured protein-split and mineral-ratio targets straight through', () => {
      const tuned = computeRequirements(
        cow,
        mergeSettings(DEFAULT_REQUIREMENT_SETTINGS, {
          degradableProteinShare: 70,
          undegradableProteinShare: 30,
          calciumToPhosphorusTarget: 1.5,
        }),
      );
      expect(tuned.rdpPct).toBe(70);
      expect(tuned.rupPct).toBe(30);
      expect(tuned.caPRatioTarget).toBe(1.5);
    });

    it('uses the configured default days-in-milk when the cow has no record', () => {
      const withoutDim = { weightKg: 450, milkTargetL: 15 };
      const base = computeRequirements(withoutDim);
      const tuned = computeRequirements(
        withoutDim,
        mergeSettings(DEFAULT_REQUIREMENT_SETTINGS, { defaultDaysInMilk: 30 }),
      );
      expect(tuned.dmKg).not.toBe(base.dmKg);
    });
  });
});
