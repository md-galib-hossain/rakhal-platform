import type { AnimalType } from '../../domain/requirements';
export declare class FeedRequirementsQueryDto {
    cattleId?: string;
    cattleIds?: string[];
    date?: string;
    weightKg?: number;
    milkTargetL?: number;
    milkFatPct?: number;
    milkProteinPct?: number;
    gestationDays?: number;
    bcs?: number;
    dim?: number;
    animalType?: AnimalType;
}
