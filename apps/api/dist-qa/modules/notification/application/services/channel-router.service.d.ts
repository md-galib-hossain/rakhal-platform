import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { NotificationChannels } from '../../domain/notification-events';
export declare class ChannelRouterService {
    private readonly prisma;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService);
    resolveChannels(eventKey: string, category: string, farmId: string): Promise<NotificationChannels>;
    getFarmRouting(farmId: string): Promise<{
        events: {
            event_key: string;
            label: string;
            category: import("../../domain/notification-events").NotificationCategory;
            can_disable: boolean;
            channels: NotificationChannels;
            farm_override: boolean;
        }[];
    }>;
    setFarmRule(farmId: string, eventKey: string, channels: string[]): Promise<{
        events: {
            event_key: string;
            label: string;
            category: import("../../domain/notification-events").NotificationCategory;
            can_disable: boolean;
            channels: NotificationChannels;
            farm_override: boolean;
        }[];
    }>;
    deleteFarmRule(farmId: string, eventKey: string): Promise<{
        events: {
            event_key: string;
            label: string;
            category: import("../../domain/notification-events").NotificationCategory;
            can_disable: boolean;
            channels: NotificationChannels;
            farm_override: boolean;
        }[];
    }>;
    private toChannels;
}
