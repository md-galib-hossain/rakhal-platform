import type { AppLanguage } from 'src/common/i18n/language';
import { NotificationService } from '../../application/services/notification.service';
import { DeviceTokenService } from '../../application/services/device-token.service';
import { ChannelRouterService } from '../../application/services/channel-router.service';
import { ListNotificationQueryDto } from '../dto/list-notification-query.dto';
import { UpdatePreferencesDto } from '../dto/update-preferences.dto';
import { RegisterDeviceDto } from '../dto/register-device.dto';
import { SetRoutingDto } from '../dto/set-routing.dto';
export declare class NotificationController {
    private readonly notifications;
    private readonly devices;
    private readonly routing;
    constructor(notifications: NotificationService, devices: DeviceTokenService, routing: ChannelRouterService);
    registerDevice(farmId: string, userId: string, dto: RegisterDeviceDto): Promise<{
        registered: boolean;
        provider: string;
        id: string;
        platform: string;
    }>;
    listDevices(userId: string): import("@prisma/client").Prisma.PrismaPromise<{
        provider: string;
        id: string;
        createdAt: Date;
        platform: string;
        lastSeenAt: Date;
    }[]>;
    unregisterDevice(userId: string, dto: RegisterDeviceDto): Promise<{
        removed: boolean;
    }>;
    list(farmId: string, userId: string, query: ListNotificationQueryDto, lang: AppLanguage): Promise<{
        unread_count: number;
        notifications: {
            id: string;
            type: string;
            priority: string;
            title: string;
            message: string;
            link: string | null;
            data: string | number | boolean | import("@prisma/client/runtime/client").JsonObject | import("@prisma/client/runtime/client").JsonArray | null;
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
            channels: import("../../domain/notification-events").NotificationChannels;
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
            channels: import("../../domain/notification-events").NotificationChannels;
        }[];
    }>;
    getRouting(farmId: string): Promise<{
        events: {
            event_key: string;
            label: string;
            category: import("../../domain/notification-events").NotificationCategory;
            can_disable: boolean;
            channels: import("../../domain/notification-events").NotificationChannels;
            farm_override: boolean;
        }[];
    }>;
    setRouting(farmId: string, eventKey: string, dto: SetRoutingDto): Promise<{
        events: {
            event_key: string;
            label: string;
            category: import("../../domain/notification-events").NotificationCategory;
            can_disable: boolean;
            channels: import("../../domain/notification-events").NotificationChannels;
            farm_override: boolean;
        }[];
    }>;
    deleteRouting(farmId: string, eventKey: string): Promise<{
        events: {
            event_key: string;
            label: string;
            category: import("../../domain/notification-events").NotificationCategory;
            can_disable: boolean;
            channels: import("../../domain/notification-events").NotificationChannels;
            farm_override: boolean;
        }[];
    }>;
}
