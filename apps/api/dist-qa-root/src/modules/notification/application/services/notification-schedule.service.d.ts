import { FarmClockService } from 'src/common/farm-time/farm-clock.service';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import type { CreateNotificationScheduleDto } from '../../presentation/dto/create-notification-schedule.dto';
import type { ListNotificationSchedulesQueryDto } from '../../presentation/dto/list-notification-schedules-query.dto';
import type { UpcomingNotificationsQueryDto } from '../../presentation/dto/upcoming-notifications-query.dto';
import type { UpdateNotificationScheduleDto } from '../../presentation/dto/update-notification-schedule.dto';
import type { NotificationClock } from '../queue/notification-clock';
import { SourceResolverRegistry } from '../resolvers/source-resolver.registry';
import { NotificationScheduler } from './notification-scheduler.service';
export declare const MAX_ACTIVE_PER_USER = 50;
export declare const MAX_ACTIVE_PER_FARM = 500;
export interface Actor {
    userId: string;
    canManage: boolean;
}
export declare class NotificationScheduleService {
    private readonly prisma;
    private readonly farmClock;
    private readonly scheduler;
    private readonly registry;
    private readonly clock;
    private readonly log;
    constructor(prisma: PrismaService, farmClock: FarmClockService, scheduler: NotificationScheduler, registry: SourceResolverRegistry, clock: NotificationClock, logger: LoggerService);
    create(farmId: string, actor: Actor, dto: CreateNotificationScheduleDto): Promise<{
        id: string;
        title: string | null;
        body: string | null;
        status: import("@prisma/client").$Enums.ScheduleStatus;
        trigger: import("@prisma/client").$Enums.ScheduleTrigger;
        date: string | null;
        time: string | null;
        all_day: boolean;
        anchor: {
            type: import("@prisma/client").$Enums.ScheduleAnchorType;
            id: string;
        } | null;
        offset_days: number | null;
        repeat: {
            type: string;
            interval: number | null;
            end_date: string | null;
        };
        lead_minutes: number[];
        audience: {
            mode: import("@prisma/client").$Enums.ScheduleAudienceMode;
            user_ids: string[];
            roles: string[];
        };
        animal_ids: string[];
        created_by: string | null;
        next_fire_at: string | null;
        created_at: string;
        can_edit: boolean;
    }>;
    preview(farmId: string, actor: Actor, dto: CreateNotificationScheduleDto): Promise<{
        timezone: string;
        all_day: boolean;
        next_fire_times: {
            fire_at: string;
            local: string;
            lead_minutes: number;
        }[];
        recipient_count: number;
    }>;
    update(farmId: string, actor: Actor, id: string, dto: UpdateNotificationScheduleDto): Promise<{
        id: string;
        title: string | null;
        body: string | null;
        status: import("@prisma/client").$Enums.ScheduleStatus;
        trigger: import("@prisma/client").$Enums.ScheduleTrigger;
        date: string | null;
        time: string | null;
        all_day: boolean;
        anchor: {
            type: import("@prisma/client").$Enums.ScheduleAnchorType;
            id: string;
        } | null;
        offset_days: number | null;
        repeat: {
            type: string;
            interval: number | null;
            end_date: string | null;
        };
        lead_minutes: number[];
        audience: {
            mode: import("@prisma/client").$Enums.ScheduleAudienceMode;
            user_ids: string[];
            roles: string[];
        };
        animal_ids: string[];
        created_by: string | null;
        next_fire_at: string | null;
        created_at: string;
        can_edit: boolean;
    }>;
    pause(farmId: string, actor: Actor, id: string): Promise<{
        id: string;
        title: string | null;
        body: string | null;
        status: import("@prisma/client").$Enums.ScheduleStatus;
        trigger: import("@prisma/client").$Enums.ScheduleTrigger;
        date: string | null;
        time: string | null;
        all_day: boolean;
        anchor: {
            type: import("@prisma/client").$Enums.ScheduleAnchorType;
            id: string;
        } | null;
        offset_days: number | null;
        repeat: {
            type: string;
            interval: number | null;
            end_date: string | null;
        };
        lead_minutes: number[];
        audience: {
            mode: import("@prisma/client").$Enums.ScheduleAudienceMode;
            user_ids: string[];
            roles: string[];
        };
        animal_ids: string[];
        created_by: string | null;
        next_fire_at: string | null;
        created_at: string;
        can_edit: boolean;
    }>;
    resume(farmId: string, actor: Actor, id: string): Promise<{
        id: string;
        title: string | null;
        body: string | null;
        status: import("@prisma/client").$Enums.ScheduleStatus;
        trigger: import("@prisma/client").$Enums.ScheduleTrigger;
        date: string | null;
        time: string | null;
        all_day: boolean;
        anchor: {
            type: import("@prisma/client").$Enums.ScheduleAnchorType;
            id: string;
        } | null;
        offset_days: number | null;
        repeat: {
            type: string;
            interval: number | null;
            end_date: string | null;
        };
        lead_minutes: number[];
        audience: {
            mode: import("@prisma/client").$Enums.ScheduleAudienceMode;
            user_ids: string[];
            roles: string[];
        };
        animal_ids: string[];
        created_by: string | null;
        next_fire_at: string | null;
        created_at: string;
        can_edit: boolean;
    }>;
    cancel(farmId: string, actor: Actor, id: string): Promise<{
        id: string;
        status: string;
    }>;
    get(farmId: string, actor: Actor, id: string): Promise<{
        id: string;
        title: string | null;
        body: string | null;
        status: import("@prisma/client").$Enums.ScheduleStatus;
        trigger: import("@prisma/client").$Enums.ScheduleTrigger;
        date: string | null;
        time: string | null;
        all_day: boolean;
        anchor: {
            type: import("@prisma/client").$Enums.ScheduleAnchorType;
            id: string;
        } | null;
        offset_days: number | null;
        repeat: {
            type: string;
            interval: number | null;
            end_date: string | null;
        };
        lead_minutes: number[];
        audience: {
            mode: import("@prisma/client").$Enums.ScheduleAudienceMode;
            user_ids: string[];
            roles: string[];
        };
        animal_ids: string[];
        created_by: string | null;
        next_fire_at: string | null;
        created_at: string;
        can_edit: boolean;
    }>;
    list(farmId: string, actor: Actor, query: ListNotificationSchedulesQueryDto): Promise<{
        items: {
            id: string;
            title: string | null;
            body: string | null;
            status: import("@prisma/client").$Enums.ScheduleStatus;
            trigger: import("@prisma/client").$Enums.ScheduleTrigger;
            date: string | null;
            time: string | null;
            all_day: boolean;
            anchor: {
                type: import("@prisma/client").$Enums.ScheduleAnchorType;
                id: string;
            } | null;
            offset_days: number | null;
            repeat: {
                type: string;
                interval: number | null;
                end_date: string | null;
            };
            lead_minutes: number[];
            audience: {
                mode: import("@prisma/client").$Enums.ScheduleAudienceMode;
                user_ids: string[];
                roles: string[];
            };
            animal_ids: string[];
            created_by: string | null;
            next_fire_at: string | null;
            created_at: string;
            can_edit: boolean;
        }[];
        meta: import("src/common/pagination").CursorPageMeta;
    }>;
    upcoming(farmId: string, actor: Actor, query: UpcomingNotificationsQueryDto): Promise<{
        items: {
            occurrence_id: string;
            schedule_id: string;
            fire_at: string;
            fire_at_local: string;
            title: string;
            body: string | null;
            origin: import("@prisma/client").$Enums.NotificationOrigin;
            category: string;
            priority: string;
            link: string | null;
            animals_count: number;
            repeat: string;
            can_edit: boolean;
        }[];
        meta: import("src/common/pagination").CursorPageMeta;
    }>;
    private compile;
    private assertAudienceExists;
    private loadAnchor;
    private fromDto;
    private fromRow;
    private overlay;
    private loadVisible;
    private loadEditable;
    private assertLimits;
    private nextFireTimes;
    private rolesOf;
    private loadMembers;
    private systemCopy;
    private localIso;
    private view;
}
