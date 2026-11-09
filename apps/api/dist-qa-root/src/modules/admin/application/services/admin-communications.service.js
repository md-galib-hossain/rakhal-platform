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
var AdminCommunicationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminCommunicationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const notification_service_1 = require("src/modules/notification/application/services/notification.service");
const admin_audit_service_1 = require("./admin-audit.service");
let AdminCommunicationsService = AdminCommunicationsService_1 = class AdminCommunicationsService {
    prisma;
    notificationService;
    audit;
    log;
    constructor(prisma, notificationService, audit, logger) {
        this.prisma = prisma;
        this.notificationService = notificationService;
        this.audit = audit;
        this.log = logger.setContext(AdminCommunicationsService_1.name);
    }
    async sendDirectMessage(adminId, userId, dto) {
        const user = await this.prisma.user.findFirst({
            where: { id: userId, deletedAt: null },
            select: {
                id: true,
                name: true,
                email: true,
                farmMembers: {
                    select: { farmId: true },
                    take: 1,
                },
            },
        });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        const farmId = user.farmMembers[0]?.farmId ?? 'system';
        const result = await this.notificationService.notifyUsers({
            farmId,
            userIds: [userId],
            eventKey: 'admin_broadcast',
            title: dto.title,
            message: dto.message,
            link: dto.link,
        });
        await this.audit.record({
            adminId,
            action: 'COMMUNICATION_SENT',
            entityType: 'User',
            entityId: userId,
            metadata: {
                title: dto.title,
                channel: dto.channel ?? 'all',
                recipientEmail: user.email,
                deliveredCount: result.length,
            },
        });
        this.log.info('Admin direct communication sent', {
            adminId,
            userId,
            title: dto.title,
        });
        return {
            delivered: result.length > 0,
            recipient: { id: user.id, name: user.name, email: user.email },
        };
    }
    async broadcast(adminId, dto) {
        let targetUserIds = [];
        if (dto.targetUserIds && dto.targetUserIds.length > 0) {
            targetUserIds = dto.targetUserIds;
        }
        else {
            switch (dto.targetAudience) {
                case 'with_telegram': {
                    const deviceTokens = await this.prisma.deviceToken.findMany({
                        where: { provider: 'telegram', user: { deletedAt: null } },
                        select: { userId: true },
                        distinct: ['userId'],
                    });
                    targetUserIds = deviceTokens.map((d) => d.userId);
                    break;
                }
                case 'owners': {
                    const owners = await this.prisma.farmMember.findMany({
                        where: {
                            role: { name: 'Owner' },
                            user: { deletedAt: null },
                        },
                        select: { userId: true },
                        distinct: ['userId'],
                    });
                    targetUserIds = owners.map((o) => o.userId);
                    break;
                }
                case 'all':
                default: {
                    const users = await this.prisma.user.findMany({
                        where: { deletedAt: null, isBlocked: false },
                        select: { id: true },
                        take: 500,
                    });
                    targetUserIds = users.map((u) => u.id);
                    break;
                }
            }
        }
        if (targetUserIds.length === 0) {
            return { targetedCount: 0, deliveredCount: 0, message: 'No recipients matched the target audience' };
        }
        const farmMembers = await this.prisma.farmMember.findMany({
            where: { userId: { in: targetUserIds } },
            select: { userId: true, farmId: true },
        });
        const farmByUser = new Map(farmMembers.map((m) => [m.userId, m.farmId]));
        let totalDelivered = 0;
        const BATCH_SIZE = 10;
        for (let i = 0; i < targetUserIds.length; i += BATCH_SIZE) {
            const batch = targetUserIds.slice(i, i + BATCH_SIZE);
            for (const uid of batch) {
                const farmId = farmByUser.get(uid) ?? 'system';
                const res = await this.notificationService.notifyUsers({
                    farmId,
                    userIds: [uid],
                    eventKey: 'admin_broadcast',
                    title: dto.title,
                    message: dto.message,
                    link: dto.link,
                });
                if (res.length > 0)
                    totalDelivered += 1;
            }
            if (i + BATCH_SIZE < targetUserIds.length) {
                await new Promise((resolve) => setTimeout(resolve, 200));
            }
        }
        await this.audit.record({
            adminId,
            action: 'COMMUNICATION_SENT',
            entityType: 'Broadcast',
            metadata: {
                title: dto.title,
                targetAudience: dto.targetAudience ?? 'custom',
                targetedCount: targetUserIds.length,
                deliveredCount: totalDelivered,
            },
        });
        this.log.info('Admin broadcast completed', {
            adminId,
            targetedCount: targetUserIds.length,
            totalDelivered,
        });
        return {
            targetedCount: targetUserIds.length,
            deliveredCount: totalDelivered,
        };
    }
    async getChannelStats() {
        const [telegramCount, pushCount, totalUsers] = await Promise.all([
            this.prisma.deviceToken.count({ where: { provider: 'telegram' } }),
            this.prisma.deviceToken.count({ where: { provider: 'fcm' } }),
            this.prisma.user.count({ where: { deletedAt: null } }),
        ]);
        return {
            totalUsers,
            telegramSubscribers: telegramCount,
            pushSubscribers: pushCount,
        };
    }
};
exports.AdminCommunicationsService = AdminCommunicationsService;
exports.AdminCommunicationsService = AdminCommunicationsService = AdminCommunicationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notification_service_1.NotificationService,
        admin_audit_service_1.AdminAuditService,
        logger_service_1.LoggerService])
], AdminCommunicationsService);
//# sourceMappingURL=admin-communications.service.js.map