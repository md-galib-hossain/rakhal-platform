import { CreateCattleDto } from './create-cattle.dto';
import { CattleGender, CattleSourceType, HerdStatus, ProductionStatus } from '@prisma/client';
export declare class UpdateCattleDto implements Partial<CreateCattleDto> {
    name?: string;
    tagNumber?: string;
    image?: string;
    breedId?: string;
    gender?: CattleGender;
    dateOfBirth?: string;
    status?: HerdStatus;
    productionStatus?: ProductionStatus;
    weightKg?: number;
    shedId?: string;
    motherId?: string;
    fatherId?: string;
    sourceType?: CattleSourceType;
    color?: string;
    notes?: string;
    priorCalvings?: number;
    bcs?: number;
    lactationStartDate?: string;
    dryOffStartDate?: string;
}
