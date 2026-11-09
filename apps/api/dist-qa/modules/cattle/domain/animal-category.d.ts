import { Prisma } from '@prisma/client';
export type AnimalCategoryGender = 'MALE' | 'FEMALE' | 'CASTRATED_MALE';
export declare const ANIMAL_CATEGORIES: readonly ["CALF", "HEIFER", "COW", "BULL", "STEER"];
export type AnimalCategory = (typeof ANIMAL_CATEGORIES)[number];
export interface DeriveAnimalCategoryInput {
    gender: AnimalCategoryGender;
    dateOfBirth: Date | null;
    totalCalvings: number;
    now?: Date;
    weaningDays?: number;
}
export declare function deriveAnimalCategory({ gender, dateOfBirth, totalCalvings, now, weaningDays, }: DeriveAnimalCategoryInput): AnimalCategory;
export declare function buildAnimalCategoryWhere(category: AnimalCategory, now: Date, weaningDays?: number): Prisma.CattleWhereInput;
