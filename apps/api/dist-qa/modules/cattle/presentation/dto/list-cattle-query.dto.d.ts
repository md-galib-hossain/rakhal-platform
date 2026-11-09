import { CattleGender, HerdStatus, ProductionStatus, ReproductionState } from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
import { type CattleCategory } from 'src/modules/animal-events/domain/eligibility/categories';
import { type AnimalCategory } from '../../domain/animal-category';
import { type DueFilter } from '../../domain/animal-upcoming-events';
import { type LifecycleSubStage } from '../../domain/lifecycle-bands';
export declare const HEALTH_STATUS_FILTERS: readonly ["HEALTHY", "SICK", "IN_TREATMENT", "WITHHOLDING", "QUARANTINE"];
export type HealthStatusFilter = (typeof HEALTH_STATUS_FILTERS)[number];
export declare class ListCattleQueryDto extends CursorPaginationQueryDto {
    search?: string;
    breedId?: string;
    gender?: CattleGender;
    status?: HerdStatus;
    productionStatus?: ProductionStatus;
    reproductiveStatus?: ReproductionState;
    animalCategory?: AnimalCategory;
    category?: CattleCategory;
    healthStatus?: HealthStatusFilter;
    lifecycleSubStage?: LifecycleSubStage;
    dueFilter?: DueFilter;
    shedId?: string;
    animalGroupId?: string;
    includeDeleted: boolean;
}
