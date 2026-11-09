export declare const SCHEDULE_TRIGGERS: readonly ["DATE", "BEFORE_EVENT", "AFTER_EVENT"];
export declare const SCHEDULE_ANCHOR_TYPES: readonly ["ANIMAL_EVENT", "TASK", "HEALTH_STEP"];
export declare const SCHEDULE_REPEAT_TYPES: readonly ["NEVER", "EVERY_N_DAYS", "WEEKLY", "MONTHLY"];
export declare const SCHEDULE_AUDIENCE_MODES: readonly ["USER", "ROLES", "USERS"];
export declare class ScheduleAnchorDto {
    type: (typeof SCHEDULE_ANCHOR_TYPES)[number];
    id: string;
}
export declare class ScheduleRepeatDto {
    type: (typeof SCHEDULE_REPEAT_TYPES)[number];
    interval?: number;
    end_date?: string;
}
export declare class ScheduleAudienceDto {
    mode: (typeof SCHEDULE_AUDIENCE_MODES)[number];
    user_id?: string;
    roles?: string[];
    user_ids?: string[];
}
export declare class CreateNotificationScheduleDto {
    title: string;
    body?: string;
    trigger: (typeof SCHEDULE_TRIGGERS)[number];
    date?: string;
    time?: string;
    anchor?: ScheduleAnchorDto;
    offset_days?: number;
    repeat?: ScheduleRepeatDto;
    lead_minutes?: number[];
    audience: ScheduleAudienceDto;
    animal_ids?: string[];
}
