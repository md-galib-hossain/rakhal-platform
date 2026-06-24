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
  LactationStatus,
  PregnancyStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { getCursorArgs, toCursorPage } from 'src/common/pagination';
import { AqrService } from 'src/modules/activity/application/services/aqr.service';
import { AncestryQueryDto } from '../../presentation/dto/ancestry-query.dto';
import { CreateCattleDto } from '../../presentation/dto/create-cattle.dto';
import { ListCattleQueryDto } from '../../presentation/dto/list-cattle-query.dto';
import { UpdateCattleDto } from '../../presentation/dto/update-cattle.dto';

type CattleSummary = Pick<Cattle, 'id' | 'name' | 'tagNumber'>;

interface AncestryNode extends CattleSummary {
  mother: AncestryNode | null;
  father: AncestryNode | null;
}

/**
 * Cattle service (PRD §8). Farm-scoped: `farmId` is supplied by the controller
 * from the verified token context (`FarmContextGuard`), so every query is scoped
 * to it and no cross-tenant access is possible. Registration emits the AQR
 * "Animal Registered" event (+50) + Activity Log entry.
 */
@Injectable()
export class CattleService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly aqrService: AqrService,
    private readonly logger: LoggerService,
  ) {
    this.log = this.logger.setContext(CattleService.name);
  }

  async create(farmId: string, userId: string, dto: CreateCattleDto) {
    await this.validateReferences(farmId, dto);
    await this.validateParentRules(farmId, undefined, dto);

    try {
      const cattle = await this.prisma.cattle.create({
        data: {
          farmId,
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

      this.log.info('Cattle created', { cattleId: cattle.id, farmId });

      // AQR: Animal Registered (+50) + immutable Activity Log entry (PRD §19.2).
      const aqr = await this.aqrService.applyEvent(
        farmId,
        cattle.id,
        'animal_registered',
        {
          actorId: userId,
          actionDetails: `New [${cattle.purpose}] [${cattle.name ?? cattle.tagNumber}] registered.`,
        },
      );

      return { ...cattle, aqrScore: aqr.aqrScore };
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Tag number already exists for this farm');
      }
      throw error;
    }
  }

  async findAll(farmId: string, query: ListCattleQueryDto) {
    const where: Prisma.CattleWhereInput = {
      farmId,
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

    const rows = await this.prisma.cattle.findMany({
      where,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
      include: this.defaultInclude(),
    });

    return toCursorPage(rows, query);
  }

  async findOne(farmId: string, id: string) {
    return this.getCattleOrThrow(farmId, id, this.defaultInclude());
  }

  async update(farmId: string, id: string, dto: UpdateCattleDto) {
    await this.getCattleOrThrow(farmId, id);
    await this.validateReferences(farmId, dto);
    await this.validateParentRules(farmId, id, dto);

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

      this.log.info('Cattle updated', { cattleId: id, farmId });
      return cattle;
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Tag number already exists for this farm');
      }
      throw error;
    }
  }

  async archive(farmId: string, id: string) {
    await this.getCattleOrThrow(farmId, id);
    const cattle = await this.prisma.cattle.update({
      where: { id },
      data: { status: CattleStatus.ARCHIVED, isActive: false },
      include: this.defaultInclude(),
    });
    this.log.info('Cattle archived', { cattleId: id, farmId });
    return cattle;
  }

  async restore(farmId: string, id: string) {
    await this.getCattleOrThrow(farmId, id);
    const cattle = await this.prisma.cattle.update({
      where: { id },
      data: { status: CattleStatus.ACTIVE, isActive: true },
      include: this.defaultInclude(),
    });
    this.log.info('Cattle restored', { cattleId: id, farmId });
    return cattle;
  }

  async remove(farmId: string, id: string) {
    return this.archive(farmId, id);
  }

  async profile(farmId: string, id: string) {
    const cattle = await this.getCattleOrThrow(farmId, id, {
      breed: true,
      shed: true,
      mother: { select: this.summarySelect() },
      father: { select: this.summarySelect() },
    });

    const childrenCount = await this.prisma.cattle.count({
      where: { farmId, OR: [{ motherId: id }, { fatherId: id }] },
    });
    const [currentPregnancy, currentLactation] = await Promise.all([
      this.prisma.pregnancy.findFirst({
        where: { cattleId: id, status: PregnancyStatus.ACTIVE },
        orderBy: { conceptionDate: 'desc' },
      }),
      this.prisma.lactation.findFirst({
        where: { cattleId: id, status: LactationStatus.ACTIVE },
        orderBy: { startDate: 'desc' },
      }),
    ]);

    return {
      ...cattle,
      age: this.calculateAge(cattle.dateOfBirth),
      childrenCount,
      dim: currentLactation
        ? this.daysBetween(currentLactation.startDate, new Date())
        : null,
      pregnancyStatus: currentPregnancy
        ? currentPregnancy.status
        : 'NOT_RECORDED',
      healthStatus: 'NOT_RECORDED',
    };
  }

  async ancestry(farmId: string, id: string, query: AncestryQueryDto) {
    await this.getCattleOrThrow(farmId, id);
    return this.buildAncestry(id, query.depth, new Set<string>());
  }

  async children(farmId: string, id: string) {
    await this.getCattleOrThrow(farmId, id);
    return this.prisma.cattle.findMany({
      where: {
        farmId,
        isActive: true,
        OR: [{ motherId: id }, { fatherId: id }],
      },
      orderBy: { tagNumber: 'asc' },
      select: this.summarySelect(),
    });
  }

  async siblings(farmId: string, id: string) {
    const cattle = await this.getCattleOrThrow(farmId, id);
    if (!cattle.motherId && !cattle.fatherId) {
      return [];
    }

    return this.prisma.cattle.findMany({
      where: {
        farmId,
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
      where: { id: { in: parentIds }, farmId },
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
        where: { OR: [{ motherId: currentId }, { fatherId: currentId }] },
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
    farmId: string,
    id: string,
    include?: T,
  ) {
    const cattle = await this.prisma.cattle.findFirst({
      where: { id, farmId },
      include,
    });

    if (!cattle) {
      this.log.warn('Cattle not found', { cattleId: id, farmId });
      throw new NotFoundException('Cattle not found');
    }

    return cattle;
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

  private daysBetween(start: Date, end: Date) {
    return Math.max(
      0,
      Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
    );
  }

  private isUniqueError(error: unknown) {
    return (error as { code?: string }).code === 'P2002';
  }
}
