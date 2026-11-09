import { FeedPlanKind, FeedPlanLineType, FeedPlanTarget } from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
export declare class FeedPlanLineDto {
    lineType: FeedPlanLineType;
    feedItemId?: string;
    concentrationId?: string;
    kgPerDay: number;
}
export declare class CreateFeedPlanDto {
    name: string;
    kind?: FeedPlanKind;
    notes?: string;
    madeForCattleId?: string;
    madeForAnimalGroupId?: string;
    lines: FeedPlanLineDto[];
}
export declare class UpdateFeedPlanDto {
    name?: string;
    kind?: FeedPlanKind;
    notes?: string;
    madeForCattleId?: string;
    madeForAnimalGroupId?: string;
    lines?: FeedPlanLineDto[];
}
export declare class ListFeedPlansQueryDto extends CursorPaginationQueryDto {
    includeArchived: boolean;
    search?: string;
    kind?: FeedPlanKind;
}
export declare class FeedPlanFitQueryDto {
    cattleIds?: string[];
    date?: string;
}
export declare class ApplyFeedPlanDto {
    targetType: FeedPlanTarget;
    cattleIds?: string[];
    animalGroupId?: string;
}
export declare class ArchiveFeedPlanQueryDto {
    removeAssignments: boolean;
}
export declare class ListPlanAssignmentsQueryDto extends CursorPaginationQueryDto {
    cattleId?: string;
    animalGroupId?: string;
    planId?: string;
    status?: 'ACTIVE' | 'ENDED';
}
export declare class PreviewManualRequirementDto {
    weightKg: number;
    milkTargetL: number;
    milkFatPct?: number;
    milkProteinPct?: number;
    gestationDays?: number;
    bcs?: number;
    dim?: number;
    animalType?: 'COW' | 'HEIFER' | 'DRY';
}
export declare class PreviewPlanFitDto {
    lines: FeedPlanLineDto[];
    cattleId?: string;
    manual?: PreviewManualRequirementDto;
}
