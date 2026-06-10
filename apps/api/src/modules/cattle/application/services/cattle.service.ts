import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Cattle,
  CattleSourceType,
  CattleStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { TenantAccessService } from 'src/modules/tenant-access/application/services/tenant-access.service';
import { AncestryQueryDto } from '../../presentation/dto/ancestry-query.dto';
import { CreateCattleDto } from '../../presentation/dto/create-cattle.dto';
import { ListCattleQueryDto } from '../../presentation/dto/list-cattle-query.dto';
import { UpdateCattleDto } from '../../presentation/dto/update-cattle.dto';

type CattleSummary = Pick<Cattle, 'id' | 'name' | 'tagNumber'>;

interface AncestryNode extends CattleSummary {
  mother: AncestryNode | null;
  father: AncestryNode | null;
}

@Injectable()
export class CattleService {
  private readonly log: LoggerService;
  private readonly sortWhitelist = new Set([
    'tagNumber',
    'name',
    'dateOfBirth',
    'createdAt',
    'updatedAt',
    'status',
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantAccessService: TenantAccessService,
    private readonly logger: LoggerService,
  ) {
    this.log = this.logger.setContext(CattleService.name);
  }

  async create(userId: string, dto: CreateCattleDto) {
    await this.assertFarmAccess(userId, dto.farmId);
    await this.validateReferences(dto.farmId, dto);
    await this.validateParentRules(dto.farmId, undefined, dto);

    try {
      const cattle = await this.prisma.cattle.create({
        data: {
          farmId: dto.farmId,
          name: dto.name,
          tagNumber: dto.tagNumber,
          image: dto.image,
          breedId: dto.breedId,
          gender: dto.gender,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          purpose: dto.purpose,
          status: dto.status ?? CattleStatus.ACTIVE,
          shedId: dto.shedId,
          motherId: dto.motherId,
          fatherId: dto.fatherId,
          sourceType: dto.sourceType ?? CattleSourceType.UNKNOWN,
          color: dto.color,
          notes: dto.notes,
          isActive: dto.status !== CattleStatus.ARCHIVED,
          createdBy: userId,
        },
        include: this.defaultInclude(),
      });

      this.log.info('Cattle created', {
        cattleId: cattle.id,
        farmId: cattle.farmId,
      });

      return cattle;
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Tag number already exists for this farm');
      }
      throw error;
    }
  }

  async findAll(userId: string, query: ListCattleQueryDto) {
    if (!query.farmId) {
      throw new BadRequestException('farmId is required');
    }

    await this.assertFarmAccess(userId, query.farmId);

    const page = query.page;
    const limit = query.limit;
    const where: Prisma.CattleWhereInput = {
      farmId: query.farmId,
      ...(query.includeArchived
        ? {}
        : { isActive: true, status: { not: CattleStatus.ARCHIVED } }),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { tagNumber: { contains: query.search, mode: 'insensitive' } },
              { color: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.breedId ? { breedId: query.breedId } : {}),
      ...(query.gender ? { gender: query.gender } : {}),
      ...(query.purpose ? { purpose: query.purpose } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.shedId ? { shedId: query.shedId } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.cattle.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: this.orderBy(query.sortBy, query.sortOrder),
        include: this.defaultInclude(),
      }),
      this.prisma.cattle.count({ where }),
    ]);

    return this.paginate(items, total, page, limit);
  }

  async findOne(userId: string, id: string) {
    const cattle = await this.getCattleOrThrow(id, this.defaultInclude());
    await this.assertFarmAccess(userId, cattle.farmId);
    return cattle;
  }

  async update(userId: string, id: string, dto: UpdateCattleDto) {
    const existing = await this.getCattleOrThrow(id);
    await this.assertFarmAccess(userId, existing.farmId);

    if (dto.farmId && dto.farmId !== existing.farmId) {
      throw new BadRequestException('farmId cannot be changed');
    }

    await this.validateReferences(existing.farmId, dto);
    await this.validateParentRules(existing.farmId, id, dto);

    try {
      const cattle = await this.prisma.cattle.update({
        where: { id },
        data: {
          name: dto.name,
          tagNumber: dto.tagNumber,
          image: dto.image,
          breedId: dto.breedId,
          gender: dto.gender,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          purpose: dto.purpose,
          status: dto.status,
          shedId: dto.shedId,
          motherId: dto.motherId,
          fatherId: dto.fatherId,
          sourceType: dto.sourceType,
          color: dto.color,
          notes: dto.notes,
          ...(dto.status
            ? { isActive: dto.status !== CattleStatus.ARCHIVED }
            : {}),
        },
        include: this.defaultInclude(),
      });

      this.log.info('Cattle updated', { cattleId: id, farmId: existing.farmId });
      return cattle;
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Tag number already exists for this farm');
      }
      throw error;
    }
  }

  async archive(userId: string, id: string) {
    const existing = await this.findOne(userId, id);
    const cattle = await this.prisma.cattle.update({
      where: { id },
      data: {
        status: CattleStatus.ARCHIVED,
        isActive: false,
      },
      include: this.defaultInclude(),
    });

    this.log.info('Cattle archived', {
      cattleId: id,
      farmId: existing.farmId,
    });

    return cattle;
  }

  async restore(userId: string, id: string) {
    const existing = await this.findOne(userId, id);
    const cattle = await this.prisma.cattle.update({
      where: { id },
      data: {
        status: CattleStatus.ACTIVE,
        isActive: true,
      },
      include: this.defaultInclude(),
    });

    this.log.info('Cattle restored', {
      cattleId: id,
      farmId: existing.farmId,
    });

    return cattle;
  }

  async remove(userId: string, id: string) {
    const existing = await this.archive(userId, id);
    this.log.info('Cattle soft deleted', {
      cattleId: id,
      farmId: existing.farmId,
    });
    return existing;
  }

  async profile(userId: string, id: string) {
    const cattle = await this.getCattleOrThrow(id, {
      breed: true,
      shed: true,
      mother: { select: this.summarySelect() },
      father: { select: this.summarySelect() },
    });
    await this.assertFarmAccess(userId, cattle.farmId);

    const childrenCount = await this.prisma.cattle.count({
      where: {
        farmId: cattle.farmId,
        OR: [{ motherId: id }, { fatherId: id }],
      },
    });

    return {
      ...cattle,
      age: this.calculateAge(cattle.dateOfBirth),
      childrenCount,
      dim: null,
      pregnancyStatus: 'NOT_RECORDED',
      healthStatus: 'NOT_RECORDED',
    };
  }

  async ancestry(userId: string, id: string, query: AncestryQueryDto) {
    const cattle = await this.getCattleOrThrow(id);
    await this.assertFarmAccess(userId, cattle.farmId);
    return this.buildAncestry(id, query.depth, new Set<string>());
  }

  async children(userId: string, id: string) {
    const cattle = await this.getCattleOrThrow(id);
    await this.assertFarmAccess(userId, cattle.farmId);

    return this.prisma.cattle.findMany({
      where: {
        farmId: cattle.farmId,
        isActive: true,
        OR: [{ motherId: id }, { fatherId: id }],
      },
      orderBy: { tagNumber: 'asc' },
      select: this.summarySelect(),
    });
  }

  async siblings(userId: string, id: string) {
    const cattle = await this.getCattleOrThrow(id);
    await this.assertFarmAccess(userId, cattle.farmId);

    if (!cattle.motherId && !cattle.fatherId) {
      return [];
    }

    return this.prisma.cattle.findMany({
      where: {
        farmId: cattle.farmId,
        id: { not: id },
        isActive: true,
        OR: [
          ...(cattle.motherId ? [{ motherId: cattle.motherId }] : []),
          ...(cattle.fatherId ? [{ fatherId: cattle.fatherId }] : []),
        ],
      },
      orderBy: { tagNumber: 'asc' },
      select: this.summarySelect(),
    });
  }

  private async validateReferences(
    farmId: string,
    dto: Partial<CreateCattleDto>,
  ) {
    if (dto.breedId) {
      const breed = await this.prisma.breed.findFirst({
        where: { id: dto.breedId, farmId, isActive: true },
        select: { id: true },
      });
      if (!breed) {
        throw new BadRequestException('Breed must belong to the same farm');
      }
    }

    if (dto.shedId) {
      const shed = await this.prisma.shed.findFirst({
        where: { id: dto.shedId, farmId, isActive: true },
        select: { id: true },
      });
      if (!shed) {
        throw new BadRequestException('Shed must belong to the same farm');
      }
    }
  }

  private async validateParentRules(
    farmId: string,
    cattleId: string | undefined,
    dto: Partial<CreateCattleDto>,
  ) {
    const parentIds = [dto.motherId, dto.fatherId].filter(
      (parentId): parentId is string => Boolean(parentId),
    );

    if (cattleId && parentIds.includes(cattleId)) {
      throw new BadRequestException('A cattle cannot be its own parent');
    }

    if (parentIds.length === 0) {
      return;
    }

    const parents = await this.prisma.cattle.findMany({
      where: {
        id: { in: parentIds },
        farmId,
      },
      select: { id: true },
    });

    if (parents.length !== new Set(parentIds).size) {
      throw new BadRequestException(
        'Mother and father must belong to the same farm',
      );
    }

    if (cattleId) {
      for (const parentId of parentIds) {
        const createsCycle = await this.isDescendant(parentId, cattleId);
        if (createsCycle) {
          throw new BadRequestException('Circular ancestry is not allowed');
        }
      }
    }
  }

  private async isDescendant(startId: string, targetId: string) {
    const queue = [startId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId || visited.has(currentId)) continue;
      if (currentId === targetId) return true;

      visited.add(currentId);
      const children = await this.prisma.cattle.findMany({
        where: {
          OR: [{ motherId: currentId }, { fatherId: currentId }],
        },
        select: { id: true },
      });

      queue.push(...children.map((child) => child.id));
    }

    return false;
  }

  private async buildAncestry(
    id: string,
    depth: number,
    visited: Set<string>,
  ): Promise<AncestryNode | null> {
    if (depth < 1 || visited.has(id)) {
      return null;
    }

    visited.add(id);

    const cattle = await this.prisma.cattle.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        tagNumber: true,
        motherId: true,
        fatherId: true,
      },
    });

    if (!cattle) {
      return null;
    }

    return {
      id: cattle.id,
      name: cattle.name,
      tagNumber: cattle.tagNumber,
      mother: cattle.motherId
        ? await this.buildAncestry(cattle.motherId, depth - 1, new Set(visited))
        : null,
      father: cattle.fatherId
        ? await this.buildAncestry(cattle.fatherId, depth - 1, new Set(visited))
        : null,
    };
  }

  private async getCattleOrThrow<T extends Prisma.CattleInclude | undefined>(
    id: string,
    include?: T,
  ) {
    const cattle = await this.prisma.cattle.findUnique({
      where: { id },
      include,
    });

    if (!cattle) {
      this.log.warn('Cattle not found', { cattleId: id });
      throw new NotFoundException('Cattle not found');
    }

    return cattle;
  }

  private async assertFarmAccess(userId: string, farmId: string) {
    await this.tenantAccessService.resolveFarmContext(userId, farmId);
  }

  private defaultInclude() {
    return {
      breed: true,
      shed: true,
      mother: { select: this.summarySelect() },
      father: { select: this.summarySelect() },
    } satisfies Prisma.CattleInclude;
  }

  private summarySelect() {
    return {
      id: true,
      name: true,
      tagNumber: true,
    } satisfies Prisma.CattleSelect;
  }

  private calculateAge(dateOfBirth: Date | null) {
    if (!dateOfBirth) {
      return null;
    }

    const now = new Date();
    let years = now.getFullYear() - dateOfBirth.getFullYear();
    let months = now.getMonth() - dateOfBirth.getMonth();
    const days = now.getDate() - dateOfBirth.getDate();

    if (days < 0) {
      months -= 1;
    }

    if (months < 0) {
      years -= 1;
      months += 12;
    }

    return { years, months };
  }

  private orderBy(sortBy = 'createdAt', sortOrder: 'asc' | 'desc' = 'desc') {
    const field = this.sortWhitelist.has(sortBy) ? sortBy : 'createdAt';
    return { [field]: sortOrder };
  }

  private paginate<T>(items: T[], total: number, page: number, limit: number) {
    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private isUniqueError(error: unknown) {
    return (error as { code?: string }).code === 'P2002';
  }
}
