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
var AnimalGroupService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnimalGroupService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const pagination_1 = require("src/common/pagination");
let AnimalGroupService = AnimalGroupService_1 = class AnimalGroupService {
    prisma;
    log;
    constructor(prisma, logger) {
        this.prisma = prisma;
        this.log = logger.setContext(AnimalGroupService_1.name);
    }
    async create(farmId, userId, dto) {
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
        }
        catch (error) {
            if (this.isUniqueError(error)) {
                throw new common_1.ConflictException(`Animal group "${dto.name}" already exists`);
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
        const rows = await this.prisma.animalGroup.findMany({
            where,
            include: { _count: { select: { members: true } } },
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
        });
        const page = (0, pagination_1.toCursorPage)(rows, query);
        return { ...page, items: page.items.map((g) => this.toView(g)) };
    }
    async findOne(farmId, id) {
        const group = await this.prisma.animalGroup.findFirst({
            where: { id, farmId },
            include: { _count: { select: { members: true } } },
        });
        if (!group)
            throw new common_1.NotFoundException('Animal group not found');
        return this.toView(group);
    }
    async update(farmId, id, dto) {
        await this.getOrThrow(farmId, id);
        try {
            await this.prisma.animalGroup.update({
                where: { id },
                data: { name: dto.name, description: dto.description },
            });
        }
        catch (error) {
            if (this.isUniqueError(error)) {
                throw new common_1.ConflictException('An animal group with that name exists');
            }
            throw error;
        }
        this.log.info('Animal group updated', { groupId: id, farmId });
        return this.findOne(farmId, id);
    }
    async remove(farmId, id) {
        await this.getOrThrow(farmId, id);
        await this.prisma.animalGroup.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
        this.log.info('Animal group archived', { groupId: id, farmId });
        return { id, deleted: true };
    }
    async addMembers(farmId, userId, id, cattleIds) {
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
    async removeMembers(farmId, id, cattleIds) {
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
    async getOrThrow(farmId, id) {
        const group = await this.prisma.animalGroup.findFirst({
            where: { id, farmId, deletedAt: null },
        });
        if (!group)
            throw new common_1.NotFoundException('Animal group not found');
        return group;
    }
    async assertCattleInFarm(farmId, cattleIds) {
        const unique = [...new Set(cattleIds ?? [])];
        if (unique.length === 0)
            return [];
        const found = await this.prisma.cattle.count({
            where: { id: { in: unique }, farmId },
        });
        if (found !== unique.length) {
            throw new common_1.BadRequestException('One or more animals do not belong to this farm');
        }
        return unique;
    }
    toView(g) {
        return {
            id: g.id,
            name: g.name,
            description: g.description,
            memberCount: g._count.members,
            deletedAt: g.deletedAt,
            createdAt: g.createdAt,
        };
    }
    isUniqueError(error) {
        return error.code === 'P2002';
    }
};
exports.AnimalGroupService = AnimalGroupService;
exports.AnimalGroupService = AnimalGroupService = AnimalGroupService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService])
], AnimalGroupService);
//# sourceMappingURL=animal-group.service.js.map