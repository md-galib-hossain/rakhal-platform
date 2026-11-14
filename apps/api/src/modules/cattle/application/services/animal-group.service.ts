import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { getCursorArgs, toCursorPage } from 'src/common/pagination';
import { CreateAnimalGroupDto } from '../../presentation/dto/create-animal-group.dto';
import { ListAnimalGroupQueryDto } from '../../presentation/dto/list-animal-group-query.dto';
import { UpdateAnimalGroupDto } from '../../presentation/dto/update-animal-group.dto';

type GroupRow = Prisma.AnimalGroupGetPayload<{
  include: { _count: { select: { members: true } } };
}>;

/**
 * Animal groups (RAKHAL-452): a named, farm-defined set of animals, many-to-many
 * with cattle. A neutral tag for bulk actions — no feeding logic lives here.
 */
@Injectable()
export class AnimalGroupService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(AnimalGroupService.name);
  }

  async create(farmId: string, userId: string, dto: CreateAnimalGroupDto) {
    const cattleIds = await this.assertCattleInFarm(farmId, dto.cattleIds);
    try {
      const group = await this.prisma.$transaction(async (tx) => {
        const created = await tx.animalGroup.create({
          data: {
            farmId,
            name: dto.name,
            description: dto.description,
            createdBy: userId,
          },
        });
        if (cattleIds.length > 0) {
          await tx.animalGroupMember.createMany({
            data: cattleIds.map((cattleId) => ({
              groupId: created.id,
              cattleId,
              farmId,
              addedBy: userId,
            })),
            skipDuplicates: true,
          });
        }
        return created;
      });
      this.log.info('Animal group created', {
        groupId: group.id,
        farmId,
        members: cattleIds.length,
      });
      return this.findOne(farmId, group.id);
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException(
          `Animal group "${dto.name}" already exists`,
        );
      }
      throw error;
    }
  }

  async findAll(farmId: string, query: ListAnimalGroupQueryDto) {
    const where: Prisma.AnimalGroupWhereInput = {
      farmId,
      ...(query.includeArchived ? {} : { deletedAt: null }),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };
    const rows = await this.prisma.animalGroup.findMany({
      where,
      include: { _count: { select: { members: true } } },
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
    });
    const page = toCursorPage(rows, query);
    return { ...page, items: page.items.map((g) => this.toView(g)) };
  }

  async findOne(farmId: string, id: string) {
    const group = await this.prisma.animalGroup.findFirst({
      where: { id, farmId },
      include: { _count: { select: { members: true } } },
    });
    if (!group) throw new NotFoundException('Animal group not found');
    return this.toView(group);
  }

  async update(farmId: string, id: string, dto: UpdateAnimalGroupDto) {
    await this.getOrThrow(farmId, id);
    try {
      await this.prisma.animalGroup.update({
        where: { id },
        data: { name: dto.name, description: dto.description },
      });
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('An animal group with that name exists');
      }
      throw error;
    }
    this.log.info('Animal group updated', { groupId: id, farmId });
    return this.findOne(farmId, id);
  }

  async remove(farmId: string, id: string) {
    await this.getOrThrow(farmId, id);
    await this.prisma.animalGroup.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    this.log.info('Animal group archived', { groupId: id, farmId });
    return { id, deleted: true };
  }

  async addMembers(
    farmId: string,
    userId: string,
    id: string,
    cattleIds: string[],
  ) {
    await this.getOrThrow(farmId, id);
    const valid = await this.assertCattleInFarm(farmId, cattleIds);
    const { count } = await this.prisma.animalGroupMember.createMany({
      data: valid.map((cattleId) => ({
        groupId: id,
        cattleId,
        farmId,
        addedBy: userId,
      })),
      skipDuplicates: true,
    });
    this.log.info('Animal group members added', {
      groupId: id,
      farmId,
      added: count,
    });
    return { ...(await this.findOne(farmId, id)), added: count };
  }

  async removeMembers(farmId: string, id: string, cattleIds: string[]) {
    await this.getOrThrow(farmId, id);
    const { count } = await this.prisma.animalGroupMember.deleteMany({
      where: { groupId: id, farmId, cattleId: { in: cattleIds } },
    });
    this.log.info('Animal group members removed', {
      groupId: id,
      farmId,
      removed: count,
    });
    return { ...(await this.findOne(farmId, id)), removed: count };
  }

  private async getOrThrow(farmId: string, id: string) {
    const group = await this.prisma.animalGroup.findFirst({
      where: { id, farmId, deletedAt: null },
    });
    if (!group) throw new NotFoundException('Animal group not found');
    return group;
  }

  /** Every id must belong to this farm — a foreign or unknown id is rejected. */
  private async assertCattleInFarm(
    farmId: string,
    cattleIds?: string[],
  ): Promise<string[]> {
    const unique = [...new Set(cattleIds ?? [])];
    if (unique.length === 0) return [];
    const found = await this.prisma.cattle.count({
      where: { id: { in: unique }, farmId },
    });
    if (found !== unique.length) {
      throw new BadRequestException(
        'One or more animals do not belong to this farm',
      );
    }
    return unique;
  }

  private toView(g: GroupRow) {
    return {
      id: g.id,
      name: g.name,
      description: g.description,
      memberCount: g._count.members,
      deletedAt: g.deletedAt,
      createdAt: g.createdAt,
    };
  }

  private isUniqueError(error: unknown) {
    return (error as { code?: string }).code === 'P2002';
  }
}
