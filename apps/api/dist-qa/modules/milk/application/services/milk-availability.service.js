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
var MilkAvailabilityService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MilkAvailabilityService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
let MilkAvailabilityService = MilkAvailabilityService_1 = class MilkAvailabilityService {
    prisma;
    log;
    constructor(prisma, logger) {
        this.prisma = prisma;
        this.log = logger.setContext(MilkAvailabilityService_1.name);
    }
    async getAvailability(farmId, tankId) {
        if (tankId) {
            const tank = await this.prisma.milkTank.findFirst({
                where: { id: tankId, farmId, tankType: client_1.MilkTankType.SELLABLE },
                select: {
                    id: true,
                    name: true,
                    currentVolumeL: true,
                    totalCapacityL: true,
                },
            });
            if (!tank) {
                throw new common_1.NotFoundException('Sellable milk tank not found');
            }
            return this.present([tank]);
        }
        const tanks = await this.prisma.milkTank.findMany({
            where: { farmId, tankType: client_1.MilkTankType.SELLABLE, deletedAt: null },
            select: {
                id: true,
                name: true,
                currentVolumeL: true,
                totalCapacityL: true,
            },
            orderBy: { currentVolumeL: 'desc' },
        });
        return this.present(tanks);
    }
    async lockAndValidate(farmId, tankId, requiredVolumeL, tx) {
        const rows = await tx.$queryRaw(client_1.Prisma.sql `SELECT "id", "currentVolumeL" FROM "MilkTank" WHERE "id" = ${tankId} AND "farmId" = ${farmId} FOR UPDATE`);
        const tank = rows[0];
        if (!tank) {
            throw new common_1.NotFoundException('Milk tank not found');
        }
        if (tank.currentVolumeL < requiredVolumeL) {
            throw new common_1.BadRequestException(`Insufficient milk available: ${tank.currentVolumeL}L in tank, ${requiredVolumeL}L requested`);
        }
        this.log.info('Milk tank locked for sale', {
            farmId,
            tankId,
            currentVolumeL: tank.currentVolumeL,
            requiredVolumeL,
        });
        return tank;
    }
    present(tanks) {
        const presented = tanks.map((t) => ({
            tankId: t.id,
            tankName: t.name,
            availableL: t.currentVolumeL,
            totalCapacityL: t.totalCapacityL,
        }));
        return {
            tanks: presented,
            totalAvailableL: presented.reduce((sum, t) => sum + t.availableL, 0),
        };
    }
};
exports.MilkAvailabilityService = MilkAvailabilityService;
exports.MilkAvailabilityService = MilkAvailabilityService = MilkAvailabilityService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService])
], MilkAvailabilityService);
//# sourceMappingURL=milk-availability.service.js.map