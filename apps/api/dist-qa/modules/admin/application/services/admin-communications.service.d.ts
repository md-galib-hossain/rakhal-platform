import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { NotificationService } from 'src/modules/notification/application/services/notification.service';
import { AdminBroadcastMessageDto, AdminSendMessageDto } from '../../presentation/dto/admin-communication.dto';
import { AdminAuditService } from './admin-audit.service';
export declare class AdminCommunicationsService {
    private readonly prisma;
    private readonly notificationService;
    private readonly audit;
    private readonly log;
    constructor(prisma: PrismaService, notificationService: NotificationService, audit: AdminAuditService, logger: LoggerService);
    sendDirectMessage(adminId: string, userId: string, dto: AdminSendMessageDto): Promise<{
        delivered: boolean;
        recipient: {
            id: string;
            name: string;
            email: string;
        };
    }>;
    broadcast(adminId: string, dto: AdminBroadcastMessageDto): Promise<{
        targetedCount: number;
        deliveredCount: number;
        message: string;
    } | {
        targetedCount: number;
        deliveredCount: number;
        message?: undefined;
    }>;
    getChannelStats(): Promise<{
        totalUsers: number;
        telegramSubscribers: number;
        pushSubscribers: number;
    }>;
}
