import { ReproductionService } from '../../application/services/reproduction.service';
import { ReproductionListQueryDto } from '../dto/common.dto';
import { ListPregnanciesQueryDto } from '../dto/list-pregnancies-query.dto';
import { ListReproductionCowsQueryDto } from '../dto/list-reproduction-cows-query.dto';
export declare class ReproductionController {
    private readonly reproductionService;
    constructor(reproductionService: ReproductionService);
    listHeatEvents(farmId: string, query: ReproductionListQueryDto): Promise<import("../../../../common/pagination").CursorPage<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        cattleId: string;
        notes: string | null;
        animalEventId: string | null;
        heatDateTime: Date;
        detectionMethod: import("@prisma/client").$Enums.HeatDetectionMethod;
        standingHeat: boolean;
        mucusDischarge: boolean;
        mountingBehavior: boolean;
        restlessness: boolean;
        resolvedAt: Date | null;
        resolvedByBreedingEventId: string | null;
        resolutionReason: import("@prisma/client").$Enums.HeatResolutionReason | null;
        returnedFromBreedingEventId: string | null;
    }>>;
    listBreedingEvents(farmId: string, query: ReproductionListQueryDto): Promise<import("../../../../common/pagination").CursorPage<{
        bull: {
            name: string | null;
            id: string;
            tagNumber: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.BreedingStatus;
        cattleId: string;
        notes: string | null;
        voidedAt: Date | null;
        voidedById: string | null;
        voidReason: string | null;
        bullId: string | null;
        semenType: import("@prisma/client").$Enums.SemenType | null;
        targetSex: import("@prisma/client").$Enums.TargetSex | null;
        animalEventId: string | null;
        breedingDate: Date;
        breedingMethod: import("@prisma/client").$Enums.BreedingMethod;
        semenBatchId: string | null;
        inseminator: string | null;
        semenSource: import("@prisma/client").$Enums.SemenSource | null;
        serviceProviderId: string | null;
        sireNameOrCode: string | null;
        sireBreed: string | null;
        strawBatchCode: string | null;
        semenCompany: string | null;
        serviceCost: number | null;
        paymentMethod: import("@prisma/client").$Enums.PaymentMethod | null;
        financeTransactionId: string | null;
        breedingNumber: number;
        expectedPregnancyCheckDate: Date | null;
    }>>;
    getBreedingEvent(farmId: string, id: string): Promise<{
        cattle: {
            farmId: string;
            id: string;
        };
        pregnancies: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: import("@prisma/client").$Enums.PregnancyStatus;
            cattleId: string;
            breedingEventId: string | null;
            expectedCalvingDate: Date | null;
            conceptionDate: Date | null;
            conceptionConfidence: import("@prisma/client").$Enums.ConceptionConfidence;
            actualCalvingDate: Date | null;
            gestationDays: number | null;
            calculatedCalvingDate: Date | null;
            expectedCalvingDateSource: import("@prisma/client").$Enums.ExpectedCalvingDateSource;
            sourceDiagnosisId: string | null;
            correctionReason: string | null;
            correctedBy: string | null;
            correctedAt: Date | null;
        }[];
        bull: {
            name: string | null;
            id: string;
            tagNumber: string;
        } | null;
        diagnoses: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            result: import("@prisma/client").$Enums.PregnancyDiagnosisResult;
            cattleId: string;
            notes: string | null;
            animalEventId: string | null;
            breedingEventId: string | null;
            expectedCalvingDate: Date | null;
            gestationDay: number | null;
            diagnosisDate: Date;
            diagnosisMethod: import("@prisma/client").$Enums.PregnancyDiagnosisMethod;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.BreedingStatus;
        cattleId: string;
        notes: string | null;
        voidedAt: Date | null;
        voidedById: string | null;
        voidReason: string | null;
        bullId: string | null;
        semenType: import("@prisma/client").$Enums.SemenType | null;
        targetSex: import("@prisma/client").$Enums.TargetSex | null;
        animalEventId: string | null;
        breedingDate: Date;
        breedingMethod: import("@prisma/client").$Enums.BreedingMethod;
        semenBatchId: string | null;
        inseminator: string | null;
        semenSource: import("@prisma/client").$Enums.SemenSource | null;
        serviceProviderId: string | null;
        sireNameOrCode: string | null;
        sireBreed: string | null;
        strawBatchCode: string | null;
        semenCompany: string | null;
        serviceCost: number | null;
        paymentMethod: import("@prisma/client").$Enums.PaymentMethod | null;
        financeTransactionId: string | null;
        breedingNumber: number;
        expectedPregnancyCheckDate: Date | null;
    }>;
    listPregnancies(farmId: string, query: ListPregnanciesQueryDto): Promise<import("../../../../common/pagination").CursorPage<{
        cattle: {
            name: string | null;
            id: string;
            tagNumber: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.PregnancyStatus;
        cattleId: string;
        breedingEventId: string | null;
        expectedCalvingDate: Date | null;
        conceptionDate: Date | null;
        conceptionConfidence: import("@prisma/client").$Enums.ConceptionConfidence;
        actualCalvingDate: Date | null;
        gestationDays: number | null;
        calculatedCalvingDate: Date | null;
        expectedCalvingDateSource: import("@prisma/client").$Enums.ExpectedCalvingDateSource;
        sourceDiagnosisId: string | null;
        correctionReason: string | null;
        correctedBy: string | null;
        correctedAt: Date | null;
    }>>;
    listCalvingEvents(farmId: string, query: ReproductionListQueryDto): Promise<import("../../../../common/pagination").CursorPage<{
        lactations: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: import("@prisma/client").$Enums.LactationStatus;
            startDate: Date;
            endDate: Date | null;
            cattleId: string;
            lactationNumber: number;
            calvingEventId: string | null;
            peakMilkDate: Date | null;
            startReason: import("@prisma/client").$Enums.LactationStartReason;
            sourceCalvingEventId: string | null;
            endReason: import("@prisma/client").$Enums.LactationEndReason | null;
            isEstimated: boolean;
            estimatedLactationNumber: number | null;
            estimatedDaysInMilk: number | null;
            peakMilkYield: number | null;
            peakDaysInMilk: number | null;
            recommendedDryOffAt: Date | null;
            plannedDryOffAt: Date | null;
        }[];
        calfBirths: ({
            calf: {
                name: string | null;
                farmId: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                aqrScore: number | null;
                tagNumber: string;
                image: string | null;
                breedId: string | null;
                gender: import("@prisma/client").$Enums.CattleGender;
                dateOfBirth: Date | null;
                herdStatus: import("@prisma/client").$Enums.HerdStatus;
                shedId: string | null;
                productionStatus: import("@prisma/client").$Enums.ProductionStatus | null;
                lastBcs: number | null;
                lastWeightKg: number | null;
                motherId: string | null;
                fatherId: string | null;
                sourceType: import("@prisma/client").$Enums.CattleSourceType;
                color: string | null;
                notes: string | null;
                profilePhotoAssetId: string | null;
                deletedById: string | null;
                soldAt: Date | null;
                dispositionId: string | null;
                enteredHerdAt: Date | null;
                createdBy: string;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            status: import("@prisma/client").$Enums.CalfBirthStatus;
            gender: import("@prisma/client").$Enums.CattleGender;
            calfId: string | null;
            calvingEventId: string;
            birthWeight: import("@prisma/client/runtime/client").Decimal | null;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        cattleId: string;
        notes: string | null;
        animalEventId: string | null;
        calvingDate: Date;
        pregnancyId: string | null;
        calvingNumber: number;
        calvingEase: import("@prisma/client").$Enums.CalvingEase;
        calfCount: number;
        placentaExpelled: boolean;
        retainedPlacenta: boolean;
        complications: string | null;
    }>>;
    listAbortionEvents(farmId: string, query: ReproductionListQueryDto): Promise<import("../../../../common/pagination").CursorPage<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        cattleId: string;
        notes: string | null;
        animalEventId: string | null;
        gestationDay: number | null;
        abortionDate: Date;
        pregnancyId: string | null;
        suspectedCause: string | null;
    }>>;
    listLactations(farmId: string, query: ReproductionListQueryDto): Promise<import("../../../../common/pagination").CursorPage<{
        calvingEvent: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            cattleId: string;
            notes: string | null;
            animalEventId: string | null;
            calvingDate: Date;
            pregnancyId: string | null;
            calvingNumber: number;
            calvingEase: import("@prisma/client").$Enums.CalvingEase;
            calfCount: number;
            placentaExpelled: boolean;
            retainedPlacenta: boolean;
            complications: string | null;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.LactationStatus;
        startDate: Date;
        endDate: Date | null;
        cattleId: string;
        lactationNumber: number;
        calvingEventId: string | null;
        peakMilkDate: Date | null;
        startReason: import("@prisma/client").$Enums.LactationStartReason;
        sourceCalvingEventId: string | null;
        endReason: import("@prisma/client").$Enums.LactationEndReason | null;
        isEstimated: boolean;
        estimatedLactationNumber: number | null;
        estimatedDaysInMilk: number | null;
        peakMilkYield: number | null;
        peakDaysInMilk: number | null;
        recommendedDryOffAt: Date | null;
        plannedDryOffAt: Date | null;
    }>>;
    dashboard(farmId: string): Promise<{
        kpis: {
            heat_detection_rate_pct: number | null;
            conception_rate_pct: number | null;
            pregnancy_rate_pct: number | null;
            avg_calving_interval_days: number | null;
        };
        action_required: {
            ready_for_ai: {
                cattle_id: string;
                name: string | null;
                tag: string;
                dim: number | null;
                days_open: number | null;
            }[];
            in_heat_now: {
                cattle_id: string;
                name: string | null;
                tag: string;
                heat_observed_at: Date;
            }[];
            pregnancy_check_due: {
                cattle_id: string;
                name: string | null;
                tag: string;
                ai_date: Date | null;
                check_due_date: Date;
                breeding_event_id: string | null;
            }[];
            pregnancy_recheck_due: {
                cattle_id: string;
                name: string | null;
                tag: string;
                ai_date: Date | null;
                recheck_due_date: Date;
                breeding_event_id: string | null;
            }[];
            calving_next_7_days: {
                cattle_id: string;
                pregnancy_id: string;
                name: string | null;
                tag: string;
                expected_date: Date | null;
                days_remaining: number | null;
            }[];
            dryoff_due_14_days: {
                cattle_id: string;
                name: string | null;
                tag: string;
                dim: number;
                dryoff_target_date: Date;
            }[];
        };
        calving_forecast_30_days: {
            cattle_id: string;
            name: string | null;
            tag: string;
            expected_date: Date | null;
        }[];
        open_cows: {
            cattle_id: string;
            name: string | null;
            tag: string;
            dim: number | null;
            days_open: number | null;
            last_ai_date: Date | null;
            vwp_end_date: Date | null;
            conception_rate_pct: number | null;
        }[];
    }>;
    listReproductionCows(farmId: string, query: ListReproductionCowsQueryDto): Promise<{
        items: {
            cattle_id: string;
            name: string | null;
            tag: string;
            status: import("@prisma/client").$Enums.ReproductionState | null;
            last_ai_date: Date | null;
            pregnancy_checked: boolean;
            days_open: number | null;
            days_pregnant: number | null;
            expected_calving_date: Date | null;
        }[];
        meta: import("../../../../common/pagination").CursorPageMeta;
    }>;
}
