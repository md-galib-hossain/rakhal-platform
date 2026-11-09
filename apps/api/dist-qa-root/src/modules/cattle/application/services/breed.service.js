"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var BreedService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BreedService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const pagination_1 = require("src/common/pagination");
let BreedService = BreedService_1 = class BreedService {
    prisma;
    log;
    constructor(prisma, logger) {
        this.prisma = prisma;
        this.log = logger.setContext(BreedService_1.name);
    }
    async create(farmId, dto) {
        try {
            const breed = await this.prisma.breed.create({
                data: { farmId, name: dto.name, description: dto.description },
            });
            this.log.info('Breed created', { breedId: breed.id, farmId });
            return breed;
        }
        catch (error) {
            if (this.isUniqueError(error)) {
                throw new common_1.ConflictException('Breed name already exists for this farm');
            }
            throw error;
        }
    }
    async findAll(farmId, query) {
        const where = {
            farmId,
            ...(query.includeArchived ? {} : { deletedAt: null }),
            ...(query.search
                ? { name: { contains: query.search, mode: 'insensitive' } }
                : {}),
        };
        const rows = await this.prisma.breed.findMany({
            where,
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
        });
        return (0, pagination_1.toCursorPage)(rows, query);
    }
    async findOne(farmId, id) {
        return this.getOrThrow(farmId, id);
    }
    async update(farmId, id, dto) {
        await this.getOrThrow(farmId, id);
        try {
            const breed = await this.prisma.breed.update({
                where: { id },
                data: { name: dto.name, description: dto.description },
            });
            this.log.info('Breed updated', { breedId: id, farmId });
            return breed;
        }
        catch (error) {
            if (this.isUniqueError(error)) {
                throw new common_1.ConflictException('Breed name already exists for this farm');
            }
            throw error;
        }
    }
    async archive(farmId, id) {
        await this.getOrThrow(farmId, id);
        const breed = await this.prisma.breed.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
        this.log.info('Breed archived', { breedId: id, farmId });
        return breed;
    }
    async restore(farmId, id) {
        await this.getOrThrow(farmId, id);
        const breed = await this.prisma.breed.update({
            where: { id },
            data: { deletedAt: null },
        });
        this.log.info('Breed restored', { breedId: id, farmId });
        return breed;
    }
    async remove(farmId, id) {
        return this.archive(farmId, id);
    }
    async getOrThrow(farmId, id) {
        const breed = await this.prisma.breed.findFirst({ where: { id, farmId } });
        if (!breed) {
            throw new common_1.NotFoundException('Breed not found');
        }
        return breed;
    }
    isUniqueError(error) {
        return error.code === 'P2002';
    }
};
exports.BreedService = BreedService;
exports.BreedService = BreedService = BreedService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService])
], BreedService);
//# sourceMappingURL=breed.service.js.map