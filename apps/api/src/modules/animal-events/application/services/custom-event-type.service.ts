import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import {
  CUSTOM_GROUPS,
  normalizeAppliesTo,
  validateFields,
} from '../../domain/custom-type';
import { eventError } from '../parse-payload';

export interface CustomTypeInput {
  name: string;
  group: string;
  appliesTo?: Record<string, string>;
  fields: unknown[];
  followUpDays?: number | null;
}

/** RAKHAL-486: CRUD for a farm's own event types. */
@Injectable()
export class CustomEventTypeService {
  constructor(private readonly prisma: PrismaService) {}

  list(farmId: string, includeInactive = false) {
    return this.prisma.animalEventTypeDef.findMany({
      where: { farmId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { name: 'asc' },
    });
  }

  async get(farmId: string, id: string) {
    const row = await this.prisma.animalEventTypeDef.findFirst({
      where: { id, farmId },
    });
    if (!row) throw new NotFoundException('Custom event type not found');
    return row;
  }

  async create(farmId: string, input: CustomTypeInput) {
    const data = this.check(input);
    try {
      return await this.prisma.animalEventTypeDef.create({
        data: { farmId, ...data },
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002')
        throw new ConflictException(
          'A custom event type with this name exists',
        );
      throw e;
    }
  }

  async update(farmId: string, id: string, input: Partial<CustomTypeInput>) {
    const current = await this.get(farmId, id);
    const data = this.check({
      name: input.name ?? current.name,
      group: input.group ?? current.group,
      appliesTo:
        input.appliesTo ?? (current.appliesTo as Record<string, string>),
      fields: input.fields ?? (current.fields as unknown[]),
      followUpDays:
        input.followUpDays === undefined
          ? current.followUpDays
          : input.followUpDays,
    });
    try {
      return await this.prisma.animalEventTypeDef.update({
        where: { id },
        data,
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002')
        throw new ConflictException(
          'A custom event type with this name exists',
        );
      throw e;
    }
  }

  /** Soft delete: events already recorded keep their type. */
  async deactivate(farmId: string, id: string) {
    await this.get(farmId, id);
    return this.prisma.animalEventTypeDef.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private check(input: CustomTypeInput) {
    const name = input.name?.trim();
    if (!name || name.length > 60)
      throw eventError('CUSTOM_TYPE_INVALID', 'name is required (max 60)');
    if (!CUSTOM_GROUPS.includes(input.group as never))
      throw eventError(
        'CUSTOM_TYPE_INVALID',
        `group must be one of ${CUSTOM_GROUPS.join(', ')}`,
      );
    const problems = validateFields(input.fields);
    if (problems.length)
      throw eventError('CUSTOM_TYPE_INVALID', 'fields are invalid', {
        problems,
      });
    const appliesTo = normalizeAppliesTo(input.appliesTo);
    if (!appliesTo)
      throw eventError(
        'CUSTOM_TYPE_INVALID',
        'appliesTo values must be LISTED, WARN or BLOCK',
      );
    if (
      input.followUpDays != null &&
      !(input.followUpDays >= 1 && input.followUpDays <= 365)
    )
      throw eventError('CUSTOM_TYPE_INVALID', 'followUpDays must be 1 to 365');
    return {
      name,
      group: input.group,
      appliesTo: appliesTo as unknown as Prisma.InputJsonValue,
      fields: input.fields as Prisma.InputJsonValue,
      followUpDays: input.followUpDays ?? null,
    };
  }
}
