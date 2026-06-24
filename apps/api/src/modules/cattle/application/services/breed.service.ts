import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Breed, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CursorPage, getCursorArgs, toCursorPage } from 'src/common/pagination';
import { CreateBreedDto } from '../../presentation/dto/create-breed.dto';
import { ListBreedQueryDto } from '../../presentation/dto/list-breed-query.dto';
import { UpdateBreedDto } from '../../presentation/dto/update-breed.dto';

/** Breed reference data (PRD §8.4). Farm-scoped via the token context. */
@Injectable()
export class BreedService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(BreedService.name);
  }

  async create(farmId: string, dto: CreateBreedDto) {
    try {
      const breed = await this.prisma.breed.create({
        data: { farmId, name: dto.name, description: dto.description },
      });
      this.log.info('Breed created', { breedId: breed.id, farmId });
      return breed;
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Breed name already exists for this farm');
      }
      throw error;
    }
  }

  async findAll(
    farmId: string,
    query: ListBreedQueryDto,
  ): Promise<CursorPage<Breed>> {
    const where: Prisma.BreedWhereInput = {
      farmId,
      ...(query.includeArchived ? {} : { isActive: true }),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    const rows = await this.prisma.breed.findMany({
      where,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
    });
    return toCursorPage(rows, query);
  }

  async findOne(farmId: string, id: string) {
    return this.getOrThrow(farmId, id);
  }

  async update(farmId: string, id: string, dto: UpdateBreedDto) {
    await this.getOrThrow(farmId, id);
    try {
      const breed = await this.prisma.breed.update({
        where: { id },
        data: { name: dto.name, description: dto.description },
      });
      this.log.info('Breed updated', { breedId: id, farmId });
      return breed;
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Breed name already exists for this farm');
      }
      throw error;
    }
  }

  async archive(farmId: string, id: string) {
    await this.getOrThrow(farmId, id);
    const breed = await this.prisma.breed.update({
      where: { id },
      data: { isActive: false },
    });
    this.log.info('Breed archived', { breedId: id, farmId });
    return breed;
  }

  async restore(farmId: string, id: string) {
    await this.getOrThrow(farmId, id);
    const breed = await this.prisma.breed.update({
      where: { id },
      data: { isActive: true },
    });
    this.log.info('Breed restored', { breedId: id, farmId });
    return breed;
  }

  async remove(farmId: string, id: string) {
    return this.archive(farmId, id);
  }

  private async getOrThrow(farmId: string, id: string): Promise<Breed> {
    const breed = await this.prisma.breed.findFirst({ where: { id, farmId } });
    if (!breed) {
      throw new NotFoundException('Breed not found');
    }
    return breed;
  }

  private isUniqueError(error: unknown) {
    return (error as { code?: string }).code === 'P2002';
  }
}
