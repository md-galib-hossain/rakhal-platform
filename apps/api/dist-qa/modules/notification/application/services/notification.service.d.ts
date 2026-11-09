import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { NotificationChannels } from '../../domain/notification-events';
import { NotificationDeliveryService } from './notification-delivery.service';
import { ChannelRouterService } from './channel-router.service';
import { ListNotificationQueryDto } from '../../presentation/dto/list-notification-query.dto';
import { UpdatePreferencesDto } from '../../presentation/dto/update-preferences.dto';
import { I18nService } from 'src/common/i18n/i18n.service';
import { AppLanguage } from 'src/common/i18n/language';
export interface NotifyInput {
    farmId: string;
    userIds: string[];
    eventKey: string;
    title: string;
    message: string;
    link?: string;
    params?: Record<string, string | number>;
    data?: Record<string, unknown>;
    dedupeKey?: string;
}
export declare class NotificationService {
    private readonly prisma;
    private readonly delivery;
    private readonly router;
    private readonly i18n;
    private readonly log;
    constructor(prisma: PrismaService, delivery: NotificationDeliveryService, router: ChannelRouterService, i18n: I18nService, logger: LoggerService);
    notifyFarmRoles(input: Omit<NotifyInput, 'userIds'> & {
        roleNames: string[];
    }): Promise<{
        message: string;
        userId: string;
        farmId: string;
        params: Prisma.JsonValue | null;
        id: string;
        createdAt: Date;
        link: string | null;
        data: Prisma.JsonValue | null;
        priority: string;
        eventKey: string;
        category: string;
        title: string;
        dedupeKey: string | null;
        channelsSent: string[];
        isRead: boolean;
        readAt: Date | null;
    }[]>;
    notifyOwnersAndManagers(input: Omit<NotifyInput, 'userIds'>): Promise<{
        message: string;
        userId: string;
        farmId: string;
        params: Prisma.JsonValue | null;
        id: string;
        createdAt: Date;
        link: string | null;
        data: Prisma.JsonValue | null;
        priority: string;
        eventKey: string;
        category: string;
        title: string;
        dedupeKey: string | null;
        channelsSent: string[];
        isRead: boolean;
        readAt: Date | null;
    }[]>;
    notifyUsers(input: NotifyInput): Promise<{
        message: string;
        userId: string;
        farmId: string;
        params: Prisma.JsonValue | null;
        id: string;
        createdAt: Date;
        link: string | null;
        data: Prisma.JsonValue | null;
        priority: string;
        eventKey: string;
        category: string;
        title: string;
        dedupeKey: string | null;
        channelsSent: string[];
        isRead: boolean;
        readAt: Date | null;
    }[]>;
    list(farmId: string, userId: string, query: ListNotificationQueryDto, lang?: AppLanguage): Promise<{
        unread_count: number;
        notifications: {
            id: string;
            type: string;
            priority: string;
            title: string;
            message: string;
            link: string | null;
            data: string | number | boolean | Prisma.JsonObject | Prisma.JsonArray | null;
            read: boolean;
            created_at: Date;
        }[];
        meta: {
            page: number;
            per_page: number;
            total: number;
        };
    }>;
    markRead(farmId: string, userId: string, id: string): Promise<{
        id: string;
        read: boolean;
    }>;
    markAllRead(farmId: string, userId: string): Promise<{
        updated: number;
    }>;
    getPreferences(farmId: string, userId: string): Promise<{
        quiet_hours: {
            start: string | null;
            end: string | null;
        };
        preferences: {
            event_key: string;
            label: string;
            category: import("../../domain/notification-events").NotificationCategory;
            can_disable: boolean;
            enabled: boolean;
            channels: NotificationChannels;
        }[];
    }>;
    updatePreferences(farmId: string, userId: string, dto: UpdatePreferencesDto): Promise<{
        quiet_hours: {
            start: string | null;
            end: string | null;
        };
        preferences: {
            event_key: string;
            label: string;
            category: import("../../domain/notification-events").NotificationCategory;
            can_disable: boolean;
            enabled: boolean;
            channels: NotificationChannels;
        }[];
    }>;
    private asParams;
    private nowHm;
    private inQuietHours;
}
