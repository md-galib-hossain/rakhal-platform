import { Prisma } from '@prisma/client';
import { AnimalCategory, AnimalCategoryGender } from './animal-category';
export declare const LIFECYCLE_WEANING_DAYS = 60;
export declare const LIFECYCLE_GROWING_START_DAYS = 180;
export declare const LIFECYCLE_BREEDING_AGE_DAYS = 390;
export interface LifecycleBoundaries {
    weaningDays: number;
    growingStartDays: number;
    breedingAgeDays: number;
}
export declare const DEFAULT_LIFECYCLE_BOUNDARIES: LifecycleBoundaries;
interface LifecycleBand {
    subStage: string;
    category: AnimalCategory;
    minDays: number;
    maxDays: number | null;
}
export declare const LIFECYCLE_SUB_STAGES: readonly ["WEANED_HEIFER", "GROWING_HEIFER", "BREEDING_HEIFER", "WEANER_BULL", "GROWING_BULL", "MATURE_BULL"];
export type LifecycleSubStage = (typeof LIFECYCLE_SUB_STAGES)[number];
export declare const LIFECYCLE_BANDS: readonly LifecycleBand[];
export interface DeriveLifecycleSubStageInput {
    gender: AnimalCategoryGender;
    dateOfBirth: Date | null;
    totalCalvings: number;
    now?: Date;
    boundaries?: LifecycleBoundaries;
}
export declare function deriveLifecycleSubStage({ gender, dateOfBirth, totalCalvings, now, boundaries, }: DeriveLifecycleSubStageInput): string | null;
export declare function buildLifecycleSubStageWhere(subStage: string, now: Date, boundaries?: LifecycleBoundaries): Prisma.CattleWhereInput;
export {};
