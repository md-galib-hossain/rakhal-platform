import type { Request } from 'express';
import { IdParamDto } from 'src/common/dto';
import { PermissionService } from 'src/modules/permission/application/services/permission.service';
import { NotificationScheduleService } from '../../application/services/notification-schedule.service';
import { CreateNotificationScheduleDto } from '../dto/create-notification-schedule.dto';
import { ListNotificationSchedulesQueryDto } from '../dto/list-notification-schedules-query.dto';
import { UpcomingNotificationsQueryDto } from '../dto/upcoming-notifications-query.dto';
import { UpdateNotificationScheduleDto } from '../dto/update-notification-schedule.dto';
type AuthedRequest = Request & {
    auth: {
        user: {
            permissionsVersion: number;
        };
    };
};
export declare class NotificationScheduleController {
    private readonly schedules;
    private readonly permissions;
    constructor(schedules: NotificationScheduleService, permissions: PermissionService);
    private actor;
    upcoming(req: AuthedRequest, farmId: string, userId: string, query: UpcomingNotificationsQueryDto): Promise<{
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
        meta: import("../../../../common/pagination").CursorPageMeta;
    }>;
    list(req: AuthedRequest, farmId: string, userId: string, query: ListNotificationSchedulesQueryDto): Promise<{
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
        meta: import("../../../../common/pagination").CursorPageMeta;
    }>;
    preview(req: AuthedRequest, farmId: string, userId: string, dto: CreateNotificationScheduleDto): Promise<{
        timezone: string;
        all_day: boolean;
        next_fire_times: {
            fire_at: string;
            local: string;
            lead_minutes: number;
        }[];
        recipient_count: number;
    }>;
    create(req: AuthedRequest, farmId: string, userId: string, dto: CreateNotificationScheduleDto): Promise<{
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
    get(req: AuthedRequest, farmId: string, userId: string, { id }: IdParamDto): Promise<{
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
    update(req: AuthedRequest, farmId: string, userId: string, { id }: IdParamDto, dto: UpdateNotificationScheduleDto): Promise<{
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
    pause(req: AuthedRequest, farmId: string, userId: string, { id }: IdParamDto): Promise<{
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
    resume(req: AuthedRequest, farmId: string, userId: string, { id }: IdParamDto): Promise<{
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
    cancel(req: AuthedRequest, farmId: string, userId: string, { id }: IdParamDto): Promise<{
        id: string;
        status: string;
    }>;
}
export {};
