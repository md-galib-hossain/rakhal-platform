import { ReproductionService } from '../../application/services/reproduction.service';
export declare class CattleReproductionController {
    private readonly reproductionService;
    constructor(reproductionService: ReproductionService);
    summary(farmId: string, id: string): Promise<{
        cattle: {
            id: string;
            tagNumber: string;
        };
        status: import("@prisma/client").$Enums.ReproductionState;
        reproductionAlerts: import("../../domain/reproduction-alerts").ReproductionAlert[];
        lactationStage: import("../../domain/lactation-stage").LactationStage | null;
        pregnancyStage: import("../../domain/pregnancy-stage").PregnancyStage | null;
        currentLactation: number;
        dim: number | null;
        isEstimated: boolean;
        totalCalvings: number;
        totalPregnancies: number;
        totalAbortions: number;
        conceptionRate: number | null;
        servicesPerConception: number | null;
        averageCalvingInterval: number | null;
        expectedCalvingDate: Date | null;
        daysPregnant: number | null;
        lastBreeding: Date | null;
        daysOpen: number | null;
        gestationLength: number | null;
    }>;
}
