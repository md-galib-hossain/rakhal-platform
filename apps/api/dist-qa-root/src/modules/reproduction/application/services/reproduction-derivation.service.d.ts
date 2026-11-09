import { BreedingStatus, CattleGender, ReproductionState } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { FarmSettingsService } from 'src/modules/farm-settings/farm-settings.service';
export interface ReproductionStateInput {
    now: Date;
    gender: CattleGender | null | undefined;
    dateOfBirth: Date | null;
    hasBreedingHistory: boolean;
    hasActivePregnancy: boolean;
    lastBreeding: {
        status: BreedingStatus;
    } | null;
    lastCalving: {
        calvingDate: Date;
    } | null;
    vwpDays: number;
    breedingAgeDays?: number;
}
export declare function deriveReproductionState(input: ReproductionStateInput): ReproductionState;
export declare class ReproductionDerivationService {
    private readonly prisma;
    private readonly farmSettings;
    private readonly log;
    constructor(prisma: PrismaService, farmSettings: FarmSettingsService, logger: LoggerService);
    refreshDerivedState(farmId: string, cattleId: string): Promise<void>;
    private refreshPregnancyStatuses;
    private refreshBreedingEventStatuses;
    private refreshCattleProductionStatus;
    private refreshLactationDryOffProjection;
    private refreshReproductionProfile;
}
