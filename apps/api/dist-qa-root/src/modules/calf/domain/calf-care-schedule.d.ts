import { CattleGender } from '@prisma/client';
export interface CalfCareScheduleItem {
    key: string;
    name: string;
    details: string;
    offsetDays: number;
    dueAt: Date;
}
interface CalfCareScheduleEntry {
    key: string;
    name: string;
    details: string;
    offsetDays: number;
    femaleOnly?: boolean;
}
export declare const CALF_CARE_SCHEDULE: ReadonlyArray<CalfCareScheduleEntry>;
export declare function buildCalfCareSchedule(birthDate: Date, gender: CattleGender): CalfCareScheduleItem[];
export {};
