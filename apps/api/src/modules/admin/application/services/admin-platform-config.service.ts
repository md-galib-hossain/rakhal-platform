import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import {
  isFeatureEnabled,
  looksLikeSecretKey,
  settingValueProblem,
} from '../../domain/platform-config';
import {
  CreateFlagDto,
  SetSettingDto,
  UpdateFlagDto,
} from '../../presentation/dto/admin-config.dto';
import { AdminAuditService } from './admin-audit.service';

const snapshot = (f: {
  enabled: boolean;
  description: string;
  farmIds: string[];
}) => ({
  enabled: f.enabled,
  description: f.description,
  farmIds: f.farmIds,
});

/**
 * Platform feature flags and settings (Phase 5). Admin CRUD with before/after audit, plus
 * {@link isEnabled} for the rest of the backend to evaluate a flag (exported from `AdminModule`; no customer
 * route consumes a flag yet — wiring one in is a one-line `await config.isEnabled('key', farmId)`).
 */
@Injectable()
export class AdminPlatformConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  /** Evaluates a flag; unknown flags are off. */
  async isEnabled(key: string, farmId?: string | null): Promise<boolean> {
    const flag = await this.prisma.platformFeatureFlag.findUnique({
      where: { key },
      select: { enabled: true, farmIds: true },
    });
    return isFeatureEnabled(flag, farmId);
  }

  listFlags() {
    return this.prisma.platformFeatureFlag.findMany({
      orderBy: { key: 'asc' },
    });
  }

  async createFlag(actorId: string, dto: CreateFlagDto) {
    try {
      const flag = await this.prisma.platformFeatureFlag.create({
        data: {
          key: dto.key,
          description: dto.description ?? '',
          enabled: dto.enabled ?? false,
          farmIds: dto.farmIds ?? [],
          updatedById: actorId,
        },
      });
      await this.audit.record({
        adminId: actorId,
        action: 'FEATURE_FLAG_CREATED',
        entityType: 'PlatformFeatureFlag',
        entityId: flag.key,
        after: snapshot(flag),
        metadata: { reason: dto.reason },
      });
      return flag;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('A flag with this key already exists');
      }
      throw err;
    }
  }

  async updateFlag(actorId: string, key: string, dto: UpdateFlagDto) {
    const before = await this.getFlag(key);
    const flag = await this.prisma.platformFeatureFlag.update({
      where: { key },
      data: {
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.farmIds !== undefined ? { farmIds: dto.farmIds } : {}),
        updatedById: actorId,
      },
    });
    await this.audit.record({
      adminId: actorId,
      action: 'FEATURE_FLAG_UPDATED',
      entityType: 'PlatformFeatureFlag',
      entityId: key,
      before: snapshot(before),
      after: snapshot(flag),
      metadata: { reason: dto.reason },
    });
    return flag;
  }

  async deleteFlag(actorId: string, key: string, reason: string) {
    const before = await this.getFlag(key);
    await this.prisma.platformFeatureFlag.delete({ where: { key } });
    await this.audit.record({
      adminId: actorId,
      action: 'FEATURE_FLAG_DELETED',
      entityType: 'PlatformFeatureFlag',
      entityId: key,
      before: snapshot(before),
      metadata: { reason },
    });
    return { key, deleted: true };
  }

  listSettings() {
    return this.prisma.platformSetting.findMany({ orderBy: { key: 'asc' } });
  }

  async setSetting(actorId: string, key: string, dto: SetSettingDto) {
    if (looksLikeSecretKey(key)) {
      throw new BadRequestException(
        'Platform settings are not for credentials; use environment configuration',
      );
    }
    const problem = settingValueProblem(dto.value);
    if (problem) throw new BadRequestException(problem);

    const before = await this.prisma.platformSetting.findUnique({
      where: { key },
    });
    const value = dto.value as Prisma.InputJsonValue;
    const setting = await this.prisma.platformSetting.upsert({
      where: { key },
      create: {
        key,
        value,
        description: dto.description ?? '',
        updatedById: actorId,
      },
      update: {
        value,
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        updatedById: actorId,
      },
    });
    await this.audit.record({
      adminId: actorId,
      action: 'PLATFORM_SETTING_SET',
      entityType: 'PlatformSetting',
      entityId: key,
      before: before ? { value: before.value } : null,
      after: { value: setting.value },
      metadata: { reason: dto.reason, created: !before },
    });
    return setting;
  }

  private async getFlag(key: string) {
    const flag = await this.prisma.platformFeatureFlag.findUnique({
      where: { key },
    });
    if (!flag) throw new NotFoundException('Flag not found');
    return flag;
  }
}
