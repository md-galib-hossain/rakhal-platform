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
var DeviceTokenService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceTokenService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
let DeviceTokenService = DeviceTokenService_1 = class DeviceTokenService {
    prisma;
    log;
    constructor(prisma, logger) {
        this.prisma = prisma;
        this.log = logger.setContext(DeviceTokenService_1.name);
    }
    async register(userId, farmId, dto) {
        const device = await this.prisma.deviceToken.upsert({
            where: { token: dto.token },
            create: {
                userId,
                farmId,
                token: dto.token,
                platform: dto.platform,
                provider: dto.provider ?? 'fcm',
            },
            update: {
                userId,
                farmId,
                platform: dto.platform,
                provider: dto.provider ?? 'fcm',
                lastSeenAt: new Date(),
            },
            select: { id: true, platform: true, provider: true },
        });
        this.log.info('Device token registered', {
            userId,
            platform: dto.platform,
        });
        return { ...device, registered: true };
    }
    async unregister(userId, token) {
        const res = await this.prisma.deviceToken.deleteMany({
            where: { token, userId },
        });
        return { removed: res.count > 0 };
    }
    list(userId) {
        return this.prisma.deviceToken.findMany({
            where: { userId },
            select: {
                id: true,
                platform: true,
                provider: true,
                createdAt: true,
                lastSeenAt: true,
            },
            orderBy: { lastSeenAt: 'desc' },
        });
    }
};
exports.DeviceTokenService = DeviceTokenService;
exports.DeviceTokenService = DeviceTokenService = DeviceTokenService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService])
], DeviceTokenService);
//# sourceMappingURL=device-token.service.js.map