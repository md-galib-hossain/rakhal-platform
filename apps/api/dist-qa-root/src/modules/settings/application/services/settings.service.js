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
var SettingsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const farm_time_1 = require("src/common/farm-time/farm-time");
const herd_scope_1 = require("src/modules/cattle/domain/herd-scope");
let SettingsService = SettingsService_1 = class SettingsService {
    prisma;
    log;
    constructor(prisma, logger) {
        this.prisma = prisma;
        this.log = logger.setContext(SettingsService_1.name);
    }
    async getFarm(farmId) {
        const farm = await this.prisma.farm.findUniqueOrThrow({
            where: { id: farmId },
            select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                division: true,
                district: true,
                upazila: true,
                operationalPurpose: true,
                status: true,
                phone: true,
                address: true,
                timezone: true,
            },
        });
        return {
            timezone: farm.timezone,
            farm_id: farm.id,
            farm_slug: farm.slug,
            farm_name: farm.name,
            description: farm.description,
            division: farm.division,
            district: farm.district,
            upazila: farm.upazila,
            operational_purpose: farm.operationalPurpose,
            status: farm.status,
            phone: farm.phone,
            address: farm.address,
        };
    }
    async updateFarm(farmId, userId, dto) {
        const farm = await this.prisma.farm.findUniqueOrThrow({
            where: { id: farmId },
            select: { ownerId: true },
        });
        if (farm.ownerId !== userId) {
            throw new common_1.ForbiddenException('Only the farm owner can update farm settings');
        }
        if (dto.timezone !== undefined && !(0, farm_time_1.isValidTimezone)(dto.timezone)) {
            throw new common_1.BadRequestException(`"${dto.timezone}" is not a valid IANA timezone (e.g. "Asia/Dhaka")`);
        }
        const updated = await this.prisma.farm.update({
            where: { id: farmId },
            data: {
                ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
                ...(dto.farm_name ? { name: dto.farm_name } : {}),
                ...(dto.description !== undefined
                    ? { description: dto.description }
                    : {}),
                ...(dto.division !== undefined ? { division: dto.division } : {}),
                ...(dto.district !== undefined ? { district: dto.district } : {}),
                ...(dto.upazila !== undefined ? { upazila: dto.upazila } : {}),
                ...(dto.operational_purpose !== undefined
                    ? { operationalPurpose: dto.operational_purpose }
                    : {}),
            },
            select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                division: true,
                district: true,
                upazila: true,
                operationalPurpose: true,
                status: true,
                phone: true,
                address: true,
                timezone: true,
            },
        });
        this.log.info('Farm settings updated', { farmId });
        return this.mapFarm(updated);
    }
    async listSheds(farmId) {
        const sheds = await this.prisma.shed.findMany({
            where: { farmId },
            include: {
                responsibleMember: { select: { id: true, name: true } },
                _count: {
                    select: {
                        cattle: { where: (0, herd_scope_1.activeHerd)(farmId) },
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
        return sheds.map((s) => ({
            id: s.id,
            name: s.name,
            code: s.code,
            description: s.description,
            capacity: s.capacity,
            purpose: s.purpose,
            responsible_member: s.responsibleMember,
            current_count: s._count.cattle,
            deleted_at: s.deletedAt,
            created_at: s.createdAt,
        }));
    }
    async createShed(farmId, dto) {
        const code = dto.code ?? this.generateCode(dto.name);
        try {
            const shed = await this.prisma.shed.create({
                data: {
                    farmId,
                    name: dto.name,
                    code,
                    description: dto.description,
                    capacity: dto.capacity,
                    purpose: dto.purpose ?? client_1.ShedPurpose.GENERAL,
                    responsibleMemberId: dto.responsible_member_id,
                },
            });
            this.log.info('Shed created', { shedId: shed.id, farmId });
            return shed;
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                e.code === 'P2002') {
                throw new common_1.ConflictException(`Shed with code "${code}" already exists`);
            }
            throw e;
        }
    }
    async updateShed(farmId, id, dto) {
        await this.getShedOrThrow(farmId, id);
        try {
            const shed = await this.prisma.shed.update({
                where: { id },
                data: {
                    ...(dto.name ? { name: dto.name } : {}),
                    ...(dto.code ? { code: dto.code } : {}),
                    ...(dto.description !== undefined
                        ? { description: dto.description }
                        : {}),
                    ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
                    ...(dto.purpose ? { purpose: dto.purpose } : {}),
                    ...(dto.responsible_member_id !== undefined
                        ? { responsibleMemberId: dto.responsible_member_id }
                        : {}),
                },
            });
            return shed;
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                e.code === 'P2002') {
                throw new common_1.ConflictException('A shed with that code already exists');
            }
            throw e;
        }
    }
    async deleteShed(farmId, id) {
        const shed = await this.getShedOrThrow(farmId, id);
        const assignedCount = await this.prisma.cattle.count({
            where: { shedId: id, ...(0, herd_scope_1.activeHerd)(farmId) },
        });
        if (assignedCount > 0) {
            throw new common_1.BadRequestException(`Cannot deactivate shed — ${assignedCount} active cattle are assigned to it`);
        }
        await this.prisma.shed.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
        this.log.info('Shed deactivated', { shedId: id, farmId });
        return { id: shed.id, deleted_at: new Date() };
    }
    async getShedOrThrow(farmId, id) {
        const shed = await this.prisma.shed.findFirst({ where: { id, farmId } });
        if (!shed)
            throw new common_1.NotFoundException('Shed not found');
        return shed;
    }
    mapFarm(f) {
        return {
            timezone: f.timezone,
            farm_id: f.id,
            farm_slug: f.slug,
            farm_name: f.name,
            description: f.description,
            division: f.division,
            district: f.district,
            upazila: f.upazila,
            operational_purpose: f.operationalPurpose,
            status: f.status,
            phone: f.phone,
            address: f.address,
        };
    }
    generateCode(name) {
        return name
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '')
            .slice(0, 12);
    }
};
exports.SettingsService = SettingsService;
exports.SettingsService = SettingsService = SettingsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService])
], SettingsService);
//# sourceMappingURL=settings.service.js.map