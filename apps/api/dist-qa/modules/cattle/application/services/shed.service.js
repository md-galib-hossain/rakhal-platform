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
var ShedService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShedService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const pagination_1 = require("src/common/pagination");
let ShedService = ShedService_1 = class ShedService {
    prisma;
    log;
    constructor(prisma, logger) {
        this.prisma = prisma;
        this.log = logger.setContext(ShedService_1.name);
    }
    async create(farmId, dto) {
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
        }
        catch (error) {
            if (this.isUniqueError(error)) {
                throw new common_1.ConflictException('Shed code already exists for this farm');
            }
            throw error;
        }
    }
    async findAll(farmId, query) {
        const where = {
            farmId,
            ...(query.includeArchived ? {} : { deletedAt: null }),
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
        }
        catch (error) {
            if (this.isUniqueError(error)) {
                throw new common_1.ConflictException('Shed code already exists for this farm');
            }
            throw error;
        }
    }
    async archive(farmId, id) {
        await this.getOrThrow(farmId, id);
        const shed = await this.prisma.shed.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
        this.log.info('Shed archived', { shedId: id, farmId });
        return shed;
    }
    async restore(farmId, id) {
        await this.getOrThrow(farmId, id);
        const shed = await this.prisma.shed.update({
            where: { id },
            data: { deletedAt: null },
        });
        this.log.info('Shed restored', { shedId: id, farmId });
        return shed;
    }
    async remove(farmId, id) {
        return this.archive(farmId, id);
    }
    async getOrThrow(farmId, id) {
        const shed = await this.prisma.shed.findFirst({ where: { id, farmId } });
        if (!shed) {
            throw new common_1.NotFoundException('Shed not found');
        }
        return shed;
    }
    isUniqueError(error) {
        return error.code === 'P2002';
    }
};
exports.ShedService = ShedService;
exports.ShedService = ShedService = ShedService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService])
], ShedService);
//# sourceMappingURL=shed.service.js.map