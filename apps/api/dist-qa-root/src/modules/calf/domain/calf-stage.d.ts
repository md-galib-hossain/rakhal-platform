export declare const DAY_MS: number;
export declare const DEFAULT_WEANING_DAYS = 60;
export type CalfStage = 'newborn' | 'young' | 'pre_weaning' | 'post_weaning';
export declare function ageInDays(dateOfBirth: Date, now?: Date): number;
export declare function stageForAge(ageDays: number): CalfStage;
export declare function stageDobRange(stage: CalfStage, now?: Date): {
    gte?: Date;
    lt?: Date;
};
export declare function computeAdg(birthWeightKg: number | null, currentWeightKg: number | null, ageDays: number): number | null;
export declare function weaningTargetDate(dateOfBirth: Date, days?: number): Date;
