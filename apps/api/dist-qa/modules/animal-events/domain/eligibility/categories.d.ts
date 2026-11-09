import { Prisma } from '@prisma/client';
export declare const CATTLE_CATEGORIES: readonly ["ALL", "MALE", "FEMALE", "COW", "HEIFER", "WEANED", "CALF", "PREGNANT", "MILKING", "DRY", "FRESH", "OPEN", "FATTENING"];
export type CattleCategory = (typeof CATTLE_CATEGORIES)[number];
export interface AnimalFacts {
    gender: 'MALE' | 'FEMALE' | 'CASTRATED_MALE';
    dateOfBirth: Date | null;
    totalCalvings: number;
    productionStatus: 'MILKING' | 'DRY' | null;
    reproductiveStatus: string | null;
    activeLactationStart: Date | null;
    inFattening: boolean;
}
export interface CategoryContext {
    now: Date;
    weaningDays: number;
    breedingAgeDays: number;
    freshDays: number;
    fatteningCattleIds?: string[];
}
export interface CategoryRule {
    matches(a: AnimalFacts, ctx: CategoryContext): boolean;
    where(ctx: CategoryContext): Prisma.CattleWhereInput;
}
export declare const CATEGORY_RULES: Record<CattleCategory, CategoryRule>;
export declare function categoriesOf(a: AnimalFacts, ctx: CategoryContext): CattleCategory[];
