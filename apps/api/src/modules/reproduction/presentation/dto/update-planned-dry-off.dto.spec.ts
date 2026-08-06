import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdatePlannedDryOffDto } from './update-planned-dry-off.dto';

/**
 * RAKHAL-285 — `PATCH /reproduction/lactations/:id/planned-dry-off` body
 * validation. `plannedDryOffAt` is optional/nullable (clearing the field is
 * a valid request) but must be a real date string when supplied.
 */
describe('UpdatePlannedDryOffDto', () => {
  it('validates with no plannedDryOffAt supplied', async () => {
    const dto = plainToInstance(UpdatePlannedDryOffDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.plannedDryOffAt).toBeUndefined();
  });

  it('validates with plannedDryOffAt: null (clearing the field)', async () => {
    const dto = plainToInstance(UpdatePlannedDryOffDto, {
      plannedDryOffAt: null,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('validates with a valid ISO date string', async () => {
    const dto = plainToInstance(UpdatePlannedDryOffDto, {
      plannedDryOffAt: '2026-12-01',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.plannedDryOffAt).toBe('2026-12-01');
  });

  it('rejects a non-date string', async () => {
    const dto = plainToInstance(UpdatePlannedDryOffDto, {
      plannedDryOffAt: 'not-a-date',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'plannedDryOffAt')).toBe(true);
  });
});
