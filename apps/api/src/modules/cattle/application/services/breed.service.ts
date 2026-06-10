import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { TenantAccessService } from 'src/modules/tenant-access/application/services/tenant-access.service';
import { CreateBreedDto } from '../../presentation/dto/create-breed.dto';
import { ListBreedQueryDto } from '../../presentation/dto/list-breed-query.dto';
import { UpdateBreedDto } from '../../presentation/dto/update-breed.dto';

@Injectable()
export class BreedService {
  private readonly log: LoggerService;
  private readonly sortWhitelist = new Set(['name', 'createdAt', 'updatedAt']);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantAccessService: TenantAccessService,
    private readonly logger: LoggerService,
  ) {
    this.log = this.logger.setContext(BreedService.name);
  }

  async create(userId: string, dto: CreateBreedDto) {
    await this.assertFarmAccess(userId, dto.farmId);

    try {
      const breed = await this.prisma.breed.create({
        data: {
          farmId: dto.farmId,
          name: dto.name,
          description: dto.description,
        },
      });

      this.log.info('Breed created', {
        breedId: breed.id,
        farmId: breed.farmId,
      });

      return breed;
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Breed name already exists for this farm');
      }
      throw error;
    }
  }

  async findAll(userId: string, query: ListBreedQueryDto) {
    await this.assertFarmAccess(userId, query.farmId);

    const page = query.page;
    const limit = query.limit;
    const where: Prisma.BreedWhereInput = {
      farmId: query.farmId,
      ...(query.includeArchived ? {} : { isActive: true }),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.breed.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: this.orderBy(query.sortBy, query.sortOrder),
      }),
      this.prisma.breed.count({ where }),
    ]);

    return this.paginate(items, total, page, limit);
  }

  async findOne(userId: string, id: string) {
    const breed = await this.prisma.breed.findUnique({ where: { id } });
    if (!breed) {
      this.log.warn('Breed not found', { breedId: id });
      throw new NotFoundException('Breed not found');
    }

    await this.assertFarmAccess(userId, breed.farmId);
    return breed;
  }

  async update(userId: string, id: string, dto: UpdateBreedDto) {
    const existing = await this.findOne(userId, id);
    if (dto.farmId && dto.farmId !== existing.farmId) {
      throw new BadRequestException('farmId cannot be changed');
    }

    try {
      const breed = await this.prisma.breed.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
        },
      });

      this.log.info('Breed updated', { breedId: id, farmId: existing.farmId });
      return breed;
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Breed name already exists for this farm');
      }
      throw error;
    }
  }

  async archive(userId: string, id: string) {
    await this.findOne(userId, id);
    const breed = await this.prisma.breed.update({
      where: { id },
      data: { isActive: false },
    });
    this.log.info('Breed archived', { breedId: id, farmId: breed.farmId });
    return breed;
  }

  async restore(userId: string, id: string) {
    await this.findOne(userId, id);
    const breed = await this.prisma.breed.update({
      where: { id },
      data: { isActive: true },
    });
    this.log.info('Breed restored', { breedId: id, farmId: breed.farmId });
    return breed;
  }

  async remove(userId: string, id: string) {
    return this.archive(userId, id);
  }

  private async assertFarmAccess(userId: string, farmId: string) {
    await this.tenantAccessService.resolveFarmContext(userId, farmId);
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
