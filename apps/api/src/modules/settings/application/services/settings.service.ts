import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ShedPurpose } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { UpdateFarmSettingsDto } from '../../presentation/dto/update-farm-settings.dto';
import { CreateShedDto } from '../../presentation/dto/create-shed.dto';
import { UpdateShedDto } from '../../presentation/dto/update-shed.dto';
import { CreateFeedGroupDto } from '../../presentation/dto/create-feed-group.dto';
import { UpdateFeedGroupDto } from '../../presentation/dto/update-feed-group.dto';

@Injectable()
export class SettingsService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(SettingsService.name);
  }

  // ── Farm workspace ──────────────────────────────────────────────────────────

  async getFarm(farmId: string) {
    const farm = await this.prisma.farm.findUniqueOrThrow({
      where: { id: farmId },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        division: true,
        district: true,
        upazila: true,
        operationalPurpose: true,
        status: true,
        phone: true,
        address: true,
      },
    });
    return {
      farm_id: farm.id,
      farm_slug: farm.slug,
      farm_name: farm.name,
      description: farm.description,
      division: farm.division,
      district: farm.district,
      upazila: farm.upazila,
      operational_purpose: farm.operationalPurpose,
      status: farm.status,
      // Read-only here — the mutation path for these two lives on
      // `PATCH /billing/profile` (the Free-plan profile-completion gate),
      // not this route.
      phone: farm.phone,
      address: farm.address,
    };
  }

  async updateFarm(farmId: string, userId: string, dto: UpdateFarmSettingsDto) {
    const farm = await this.prisma.farm.findUniqueOrThrow({
      where: { id: farmId },
      select: { ownerId: true },
    });

    if (farm.ownerId !== userId) {
      throw new ForbiddenException(
        'Only the farm owner can update farm settings',
      );
    }

    const updated = await this.prisma.farm.update({
      where: { id: farmId },
      data: {
        ...(dto.farm_name ? { name: dto.farm_name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.division !== undefined ? { division: dto.division } : {}),
        ...(dto.district !== undefined ? { district: dto.district } : {}),
        ...(dto.upazila !== undefined ? { upazila: dto.upazila } : {}),
        ...(dto.operational_purpose !== undefined
          ? { operationalPurpose: dto.operational_purpose }
          : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        division: true,
        district: true,
        upazila: true,
        operationalPurpose: true,
        status: true,
        phone: true,
        address: true,
      },
    });

    this.log.info('Farm settings updated', { farmId });
    return this.mapFarm(updated);
  }

  // ── Sheds ───────────────────────────────────────────────────────────────────

  async listSheds(farmId: string) {
    const sheds = await this.prisma.shed.findMany({
      where: { farmId },
      include: {
        responsibleMember: { select: { id: true, name: true } },
        _count: {
          select: {
            cattle: { where: { herdStatus: 'ACTIVE', deletedAt: null } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return sheds.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      description: s.description,
      capacity: s.capacity,
      purpose: s.purpose,
      responsible_member: s.responsibleMember,
      current_count: s._count.cattle,
      is_active: s.isActive,
      created_at: s.createdAt,
    }));
  }

  async createShed(farmId: string, dto: CreateShedDto) {
    const code = dto.code ?? this.generateCode(dto.name);

    try {
      const shed = await this.prisma.shed.create({
        data: {
          farmId,
          name: dto.name,
          code,
          description: dto.description,
          capacity: dto.capacity,
          purpose: (dto.purpose as ShedPurpose) ?? ShedPurpose.GENERAL,
          responsibleMemberId: dto.responsible_member_id,
        },
      });
      this.log.info('Shed created', { shedId: shed.id, farmId });
      return shed;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(`Shed with code "${code}" already exists`);
      }
      throw e;
    }
  }

  async updateShed(farmId: string, id: string, dto: UpdateShedDto) {
    await this.getShedOrThrow(farmId, id);

    try {
      const shed = await this.prisma.shed.update({
        where: { id },
        data: {
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.code ? { code: dto.code } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
          ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
          ...(dto.purpose ? { purpose: dto.purpose as ShedPurpose } : {}),
          ...(dto.responsible_member_id !== undefined
            ? { responsibleMemberId: dto.responsible_member_id }
            : {}),
        },
      });
      return shed;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('A shed with that code already exists');
      }
      throw e;
    }
  }

  async deleteShed(farmId: string, id: string) {
    const shed = await this.getShedOrThrow(farmId, id);

    const assignedCount = await this.prisma.cattle.count({
      where: { shedId: id, herdStatus: 'ACTIVE', deletedAt: null },
    });
    if (assignedCount > 0) {
      throw new BadRequestException(
        `Cannot deactivate shed — ${assignedCount} active cattle are assigned to it`,
      );
    }

    await this.prisma.shed.update({ where: { id }, data: { isActive: false } });
    this.log.info('Shed deactivated', { shedId: id, farmId });
    return { id: shed.id, is_active: false };
  }

  // ── Feed Groups ─────────────────────────────────────────────────────────────

  async listFeedGroups(farmId: string) {
    const groups = await this.prisma.feedGroup.findMany({
      where: { farmId },
      include: {
        _count: {
          select: {
            cattle: { where: { herdStatus: 'ACTIVE', deletedAt: null } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      refusal_target_pct: g.refusalTargetPct,
      default_concentration_id: g.defaultConcentrationId,
      is_active: g.isActive,
      assigned_count: g._count.cattle,
      created_at: g.createdAt,
    }));
  }

  async createFeedGroup(farmId: string, dto: CreateFeedGroupDto) {
    try {
      const group = await this.prisma.feedGroup.create({
        data: {
          farmId,
          name: dto.name,
          description: dto.description,
          refusalTargetPct: dto.refusalTargetPct,
        },
      });
      this.log.info('Feed group created', { groupId: group.id, farmId });
      return group;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(`Feed group "${dto.name}" already exists`);
      }
      throw e;
    }
  }

  async updateFeedGroup(farmId: string, id: string, dto: UpdateFeedGroupDto) {
    await this.getFeedGroupOrThrow(farmId, id);

    if (dto.defaultConcentrationId) {
      const recipe = await this.prisma.feedConcentration.findFirst({
        where: {
          id: dto.defaultConcentrationId,
          farmId,
          isActive: true,
          kind: 'FEED_MIXTURE',
        },
        select: { id: true },
      });
      if (!recipe) {
        throw new BadRequestException(
          'Default recipe must be an active Total Mixed Ration (TMR) belonging to this farm',
        );
      }
    }

    try {
      return await this.prisma.feedGroup.update({
        where: { id },
        data: {
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
          ...(dto.refusalTargetPct !== undefined
            ? { refusalTargetPct: dto.refusalTargetPct }
            : {}),
          ...(dto.defaultConcentrationId !== undefined
            ? { defaultConcentrationId: dto.defaultConcentrationId }
            : {}),
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'A feed group with that name already exists',
        );
      }
      throw e;
    }
  }

  async deleteFeedGroup(farmId: string, id: string) {
    const group = await this.getFeedGroupOrThrow(farmId, id);

    const assignedCount = await this.prisma.cattle.count({
      where: { feedGroupId: id, herdStatus: 'ACTIVE', deletedAt: null },
    });
    if (assignedCount > 0) {
      throw new BadRequestException(
        `Cannot delete feed group — ${assignedCount} active cattle are assigned to it`,
      );
    }

    await this.prisma.feedGroup.delete({ where: { id } });
    this.log.info('Feed group deleted', { groupId: id, farmId });
    return { id: group.id, deleted: true };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async getShedOrThrow(farmId: string, id: string) {
    const shed = await this.prisma.shed.findFirst({ where: { id, farmId } });
    if (!shed) throw new NotFoundException('Shed not found');
    return shed;
  }

  private async getFeedGroupOrThrow(farmId: string, id: string) {
    const group = await this.prisma.feedGroup.findFirst({
      where: { id, farmId },
    });
    if (!group) throw new NotFoundException('Feed group not found');
    return group;
  }

  private mapFarm(f: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    division: string | null;
    district: string | null;
    upazila: string | null;
    operationalPurpose: string | null;
    status: string;
    phone: string | null;
    address: string | null;
  }) {
    return {
      farm_id: f.id,
      farm_slug: f.slug,
      farm_name: f.name,
      description: f.description,
      division: f.division,
      district: f.district,
      upazila: f.upazila,
      operational_purpose: f.operationalPurpose,
      status: f.status,
      phone: f.phone,
      address: f.address,
    };
  }

  private generateCode(name: string): string {
    return name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 12);
  }
}
