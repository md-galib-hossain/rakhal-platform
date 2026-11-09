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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FarmClockService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const farm_time_1 = require("./farm-time");
let FarmClockService = class FarmClockService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async timezone(farmId) {
        const farm = await this.prisma.farm.findUnique({
            where: { id: farmId },
            select: { timezone: true },
        });
        return farm?.timezone ?? farm_time_1.DEFAULT_FARM_TIMEZONE;
    }
    async todayIso(farmId) {
        return (0, farm_time_1.localDateIso)(await this.timezone(farmId));
    }
    async todayStart(farmId) {
        return (0, farm_time_1.localDayStart)(await this.timezone(farmId));
    }
    async dayStart(farmId, dateStr) {
        return dateStr ? (0, farm_time_1.dayKey)(dateStr) : this.todayStart(farmId);
    }
};
exports.FarmClockService = FarmClockService;
exports.FarmClockService = FarmClockService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FarmClockService);
//# sourceMappingURL=farm-clock.service.js.map