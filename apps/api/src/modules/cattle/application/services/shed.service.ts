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
import { CreateShedDto } from '../../presentation/dto/create-shed.dto';
import { ListShedQueryDto } from '../../presentation/dto/list-shed-query.dto';
import { UpdateShedDto } from '../../presentation/dto/update-shed.dto';

@Injectable()
export class ShedService {
  private readonly log: LoggerService;
  private readonly sortWhitelist = new Set([
    'name',
    'code',
    'capacity',
    'createdAt',
    'updatedAt',
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantAccessService: TenantAccessService,
    private readonly logger: LoggerService,
  ) {
    this.log = this.logger.setContext(ShedService.name);
  }

  async create(userId: string, dto: CreateShedDto) {
    await this.assertFarmAccess(userId, dto.farmId);

    try {
      const shed = await this.prisma.shed.create({
        data: {
          farmId: dto.farmId,
          name: dto.name,
          code: dto.code,
          description: dto.description,
          capacity: dto.capacity,
        },
      });

      this.log.info('Shed created', { shedId: shed.id, farmId: shed.farmId });
      return shed;
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Shed code already exists for this farm');
      }
      throw error;
    }
  }

  async findAll(userId: string, query: ListShedQueryDto) {
    await this.assertFarmAccess(userId, query.farmId);

    const page = query.page;
    const limit = query.limit;
    const where: Prisma.ShedWhereInput = {
      farmId: query.farmId,
      ...(query.includeArchived ? {} : { isActive: true }),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.shed.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: this.orderBy(query.sortBy, query.sortOrder),
      }),
      this.prisma.shed.count({ where }),
    ]);

    return this.paginate(items, total, page, limit);
  }

  async findOne(userId: string, id: string) {
    const shed = await this.prisma.shed.findUnique({ where: { id } });
    if (!shed) {
      this.log.warn('Shed not found', { shedId: id });
      throw new NotFoundException('Shed not found');
    }

    await this.assertFarmAccess(userId, shed.farmId);
    return shed;
  }

  async update(userId: string, id: string, dto: UpdateShedDto) {
    const existing = await this.findOne(userId, id);
    if (dto.farmId && dto.farmId !== existing.farmId) {
      throw new BadRequestException('farmId cannot be changed');
    }

    try {
      const shed = await this.prisma.shed.update({
        where: { id },
        data: {
          name: dto.name,
          code: dto.code,
          description: dto.description,
          capacity: dto.capacity,
        },
      });

      this.log.info('Shed updated', { shedId: id, farmId: existing.farmId });
      return shed;
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Shed code already exists for this farm');
      }
      throw error;
    }
  }

  async archive(userId: string, id: string) {
    await this.findOne(userId, id);
    const shed = await this.prisma.shed.update({
      where: { id },
      data: { isActive: false },
    });
    this.log.info('Shed archived', { shedId: id, farmId: shed.farmId });
    return shed;
  }

  async restore(userId: string, id: string) {
    await this.findOne(userId, id);
    const shed = await this.prisma.shed.update({
      where: { id },
      data: { isActive: true },
    });
    this.log.info('Shed restored', { shedId: id, farmId: shed.farmId });
    return shed;
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
