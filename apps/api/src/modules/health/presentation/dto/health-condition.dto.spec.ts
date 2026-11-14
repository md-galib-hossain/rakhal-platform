import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { HealthCondition } from '@prisma/client';
import { CreateHealthCaseDto } from './create-health-case.dto';
import { UpdateHealthCaseDto } from './update-health-case.dto';

/**
 * RAKHAL-275 — `HealthCase.condition` is a new optional, structured field
 * layered alongside the free-text `note` (RAKHAL-418: was the required
 * `diagnosis`). These tests only cover the new `condition` validator wiring
 * on the create/update DTOs.
 */
describe('CreateHealthCaseDto — condition', () => {
  const base = {
    cattleId: 'cattle-1',
    note: 'Mastitis in left quarter',
    careType: 'CURATIVE',
    priority: 'MEDIUM',
  };

  it('accepts a valid HealthCondition value', async () => {
    const dto = plainToInstance(CreateHealthCaseDto, {
      ...base,
      condition: HealthCondition.MASTITIS,
    });
    const errors = await validate(dto);
    expect(errors.filter((e) => e.property === 'condition')).toHaveLength(0);
  });

  it('is optional — omitting it produces no error', async () => {
    const dto = plainToInstance(CreateHealthCaseDto, { ...base });
    const errors = await validate(dto);
    expect(errors.filter((e) => e.property === 'condition')).toHaveLength(0);
    expect(dto.condition).toBeUndefined();
  });

  it('rejects a value outside the HealthCondition enum', async () => {
    const dto = plainToInstance(CreateHealthCaseDto, {
      ...base,
      condition: 'NOT_A_REAL_CONDITION',
    });
    const errors = await validate(dto);
    const conditionError = errors.find((e) => e.property === 'condition');
    expect(conditionError).toBeDefined();
    expect(conditionError?.constraints).toHaveProperty('isEnum');
  });

  it.each(Object.values(HealthCondition))(
    'accepts enum member %s',
    async (value) => {
      const dto = plainToInstance(CreateHealthCaseDto, {
        ...base,
        condition: value,
      });
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'condition')).toHaveLength(0);
    },
  );
});

describe('UpdateHealthCaseDto — condition', () => {
  it('accepts a valid HealthCondition value', async () => {
    const dto = plainToInstance(UpdateHealthCaseDto, {
      condition: HealthCondition.KETOSIS,
    });
    const errors = await validate(dto);
    expect(errors.filter((e) => e.property === 'condition')).toHaveLength(0);
  });

  it('is optional — an empty update payload produces no error', async () => {
    const dto = plainToInstance(UpdateHealthCaseDto, {});
    const errors = await validate(dto);
    expect(errors.filter((e) => e.property === 'condition')).toHaveLength(0);
  });

  it('rejects a value outside the HealthCondition enum', async () => {
    const dto = plainToInstance(UpdateHealthCaseDto, {
      condition: 'BOGUS',
    });
    const errors = await validate(dto);
    const conditionError = errors.find((e) => e.property === 'condition');
    expect(conditionError).toBeDefined();
    expect(conditionError?.constraints).toHaveProperty('isEnum');
  });
});
