import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Shed } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CursorPage, getCursorArgs, toCursorPage } from 'src/common/pagination';
import { CreateShedDto } from '../../presentation/dto/create-shed.dto';
import { ListShedQueryDto } from '../../presentation/dto/list-shed-query.dto';
import { UpdateShedDto } from '../../presentation/dto/update-shed.dto';

/** Shed management (PRD §21.3). Farm-scoped via the token context. */
@Injectable()
export class ShedService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(ShedService.name);
  }

  async create(farmId: string, dto: CreateShedDto) {
    try {
      const shed = await this.prisma.shed.create({
        data: {
          farmId,
          name: dto.name,
          code: dto.code,
          description: dto.description,
          capacity: dto.capacity,
        },
      });
      this.log.info('Shed created', { shedId: shed.id, farmId });
      return shed;
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Shed code already exists for this farm');
      }
      throw error;
    }
  }

  async findAll(
    farmId: string,
    query: ListShedQueryDto,
  ): Promise<CursorPage<Shed>> {
    const where: Prisma.ShedWhereInput = {
      farmId,
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

    const rows = await this.prisma.shed.findMany({
      where,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
    });
    return toCursorPage(rows, query);
  }

  async findOne(farmId: string, id: string) {
    return this.getOrThrow(farmId, id);
  }

  async update(farmId: string, id: string, dto: UpdateShedDto) {
    await this.getOrThrow(farmId, id);
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
      this.log.info('Shed updated', { shedId: id, farmId });
      return shed;
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Shed code already exists for this farm');
      }
      throw error;
    }
  }

  async archive(farmId: string, id: string) {
    await this.getOrThrow(farmId, id);
    const shed = await this.prisma.shed.update({
      where: { id },
      data: { isActive: false },
    });
    this.log.info('Shed archived', { shedId: id, farmId });
    return shed;
  }

  async restore(farmId: string, id: string) {
    await this.getOrThrow(farmId, id);
    const shed = await this.prisma.shed.update({
      where: { id },
      data: { isActive: true },
    });
    this.log.info('Shed restored', { shedId: id, farmId });
    return shed;
  }

  async remove(farmId: string, id: string) {
    return this.archive(farmId, id);
  }

  private async getOrThrow(farmId: string, id: string): Promise<Shed> {
    const shed = await this.prisma.shed.findFirst({ where: { id, farmId } });
    if (!shed) {
      throw new NotFoundException('Shed not found');
    }
    return shed;
  }

  private isUniqueError(error: unknown) {
    return (error as { code?: string }).code === 'P2002';
  }
}
