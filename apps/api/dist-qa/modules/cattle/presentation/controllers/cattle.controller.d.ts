import type { Response } from 'express';
import { BcsService } from '../../application/services/bcs.service';
import { CattleDetailService } from '../../application/services/cattle-detail.service';
import { CattleImportService } from '../../application/services/cattle-import.service';
import { CattleService } from '../../application/services/cattle.service';
import { WeightService } from '../../application/services/weight.service';
import { AncestryQueryDto } from '../dto/ancestry-query.dto';
import { ArchiveCattleDto } from '../dto/archive-cattle.dto';
import { BulkCattleDto } from '../dto/bulk-cattle.dto';
import { CattleFinanceQueryDto } from '../dto/cattle-finance-query.dto';
import { CreateCattleDto } from '../dto/create-cattle.dto';
import { DisposeCattleDto } from '../dto/dispose-cattle.dto';
import { ImportConfirmDto, ImportPreviewDto } from '../dto/import-cattle.dto';
import { ListCattleQueryDto } from '../dto/list-cattle-query.dto';
import { UpcomingEventsQueryDto } from '../dto/upcoming-events-query.dto';
import { UpdateCattleDto } from '../dto/update-cattle.dto';
import { WeightHistoryQueryDto } from '../dto/weight-history-query.dto';
export declare class CattleController {
    private readonly cattleService;
    private readonly bcsService;
    private readonly weightService;
    private readonly detailService;
    private readonly importService;
    constructor(cattleService: CattleService, bcsService: BcsService, weightService: WeightService, detailService: CattleDetailService, importService: CattleImportService);
    create(farmId: string, userId: string, dto: CreateCattleDto): Promise<{
        aqrScore: number | null;
        breed: {
            name: string;
            farmId: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            deletedAt: Date | null;
        } | null;
        shed: {
            name: string;
            farmId: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            deletedAt: Date | null;
            code: string;
            capacity: number | null;
            purpose: import("@prisma/client").$Enums.ShedPurpose;
            responsibleMemberId: string | null;
        } | null;
        reproductionProfile: {
            reproductiveStatus: import("@prisma/client").$Enums.ReproductionState | null;
            totalCalvings: number;
            totalAbortions: number;
            lastCalvingDate: Date | null;
        } | null;
        healthCases: {
            status: import("@prisma/client").$Enums.HealthCaseStatus;
            careType: import("@prisma/client").$Enums.HealthCareType;
            isSafetyWithholdingActive: boolean;
            milkWithdrawalUntil: Date | null;
        }[];
        safetyWithdrawals: {
            milkWithdrawalUntil: Date | null;
            meatWithdrawalUntil: Date | null;
        }[];
        mother: {
            name: string | null;
            id: string;
            tagNumber: string;
        } | null;
        father: {
            name: string | null;
            id: string;
            tagNumber: string;
        } | null;
        heatEvents: {
            heatDateTime: Date;
        }[];
        breedingEvents: {
            status: import("@prisma/client").$Enums.BreedingStatus;
            breedingDate: Date;
            expectedPregnancyCheckDate: Date | null;
        }[];
        pregnancies: {
            expectedCalvingDate: Date | null;
            conceptionDate: Date | null;
        }[];
        dryPeriods: {
            id: string;
        }[];
        lactations: {
            startDate: Date;
        }[];
        name: string | null;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
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
        reproductiveStatus: import("@prisma/client").$Enums.ReproductionState | null;
        reproductionAlerts: import("../../../reproduction/domain/reproduction-alerts").ReproductionAlert[];
        lactationStage: import("../../../reproduction/domain/lactation-stage").LactationStage | null;
        pregnancyStage: import("../../../reproduction/domain/pregnancy-stage").PregnancyStage | null;
        healthStatus: import("../../domain/health-status").DerivedHealthStatus;
        isQuarantined: boolean;
        quarantineUntil: Date | null;
        dim: number | null;
        animalCategory: "CALF" | "HEIFER" | "COW" | "BULL" | "STEER";
        lifecycleSubStage: string | null;
    }>;
    findAll(farmId: string, query: ListCattleQueryDto): Promise<{
        items: ({
            next_event: import("../../domain/animal-upcoming-events").AnimalUpcomingEvent | null;
            upcoming_event_count: number;
            breed: {
                name: string;
                farmId: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                description: string | null;
                deletedAt: Date | null;
            } | null;
            shed: {
                name: string;
                farmId: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                description: string | null;
                deletedAt: Date | null;
                code: string;
                capacity: number | null;
                purpose: import("@prisma/client").$Enums.ShedPurpose;
                responsibleMemberId: string | null;
            } | null;
            reproductionProfile: {
                reproductiveStatus: import("@prisma/client").$Enums.ReproductionState | null;
                totalCalvings: number;
                totalAbortions: number;
                lastCalvingDate: Date | null;
            } | null;
            healthCases: {
                status: import("@prisma/client").$Enums.HealthCaseStatus;
                careType: import("@prisma/client").$Enums.HealthCareType;
                isSafetyWithholdingActive: boolean;
                milkWithdrawalUntil: Date | null;
            }[];
            safetyWithdrawals: {
                milkWithdrawalUntil: Date | null;
                meatWithdrawalUntil: Date | null;
            }[];
            mother: {
                name: string | null;
                id: string;
                tagNumber: string;
            } | null;
            father: {
                name: string | null;
                id: string;
                tagNumber: string;
            } | null;
            heatEvents: {
                heatDateTime: Date;
            }[];
            breedingEvents: {
                status: import("@prisma/client").$Enums.BreedingStatus;
                breedingDate: Date;
                expectedPregnancyCheckDate: Date | null;
            }[];
            pregnancies: {
                expectedCalvingDate: Date | null;
                conceptionDate: Date | null;
            }[];
            dryPeriods: {
                id: string;
            }[];
            lactations: {
                startDate: Date;
            }[];
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
            reproductiveStatus: import("@prisma/client").$Enums.ReproductionState | null;
            reproductionAlerts: import("../../../reproduction/domain/reproduction-alerts").ReproductionAlert[];
            lactationStage: import("../../../reproduction/domain/lactation-stage").LactationStage | null;
            pregnancyStage: import("../../../reproduction/domain/pregnancy-stage").PregnancyStage | null;
            healthStatus: import("../../domain/health-status").DerivedHealthStatus;
            isQuarantined: boolean;
            quarantineUntil: Date | null;
            dim: number | null;
            animalCategory: "CALF" | "HEIFER" | "COW" | "BULL" | "STEER";
            lifecycleSubStage: string | null;
        } & {
            profile_photo: import("../../../media/application/services/media.service").MediaUrls | null;
        })[];
        meta: import("../../../../common/pagination").CursorPageMeta;
    }>;
    highlights(farmId: string): Promise<{
        total_active: number;
        total_change_pct: number | null;
        avg_herd_aqr: number;
        aqr_change_pct: number | null;
        breeding_ready_count: number;
        todays_yield_l: number;
        yield_change_pct: number | null;
    }>;
    upcomingEvents(farmId: string, id: string, query: UpcomingEventsQueryDto): Promise<import("../../application/services/animal-upcoming-events.service").AnimalUpcomingEventsResult>;
    bulk(farmId: string, dto: BulkCattleDto, userId: string): Promise<{
        action: string;
        updated: number;
        failed: number;
    } | {
        action: "export";
        updated: number;
        failed: number;
        items: ({
            breed: {
                name: string;
                farmId: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                description: string | null;
                deletedAt: Date | null;
            } | null;
            shed: {
                name: string;
                farmId: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                description: string | null;
                deletedAt: Date | null;
                code: string;
                capacity: number | null;
                purpose: import("@prisma/client").$Enums.ShedPurpose;
                responsibleMemberId: string | null;
            } | null;
            reproductionProfile: {
                reproductiveStatus: import("@prisma/client").$Enums.ReproductionState | null;
                totalCalvings: number;
                totalAbortions: number;
                lastCalvingDate: Date | null;
            } | null;
            healthCases: {
                status: import("@prisma/client").$Enums.HealthCaseStatus;
                careType: import("@prisma/client").$Enums.HealthCareType;
                isSafetyWithholdingActive: boolean;
                milkWithdrawalUntil: Date | null;
            }[];
            safetyWithdrawals: {
                milkWithdrawalUntil: Date | null;
                meatWithdrawalUntil: Date | null;
            }[];
            mother: {
                name: string | null;
                id: string;
                tagNumber: string;
            } | null;
            father: {
                name: string | null;
                id: string;
                tagNumber: string;
            } | null;
            heatEvents: {
                heatDateTime: Date;
            }[];
            breedingEvents: {
                status: import("@prisma/client").$Enums.BreedingStatus;
                breedingDate: Date;
                expectedPregnancyCheckDate: Date | null;
            }[];
            pregnancies: {
                expectedCalvingDate: Date | null;
                conceptionDate: Date | null;
            }[];
            dryPeriods: {
                id: string;
            }[];
            lactations: {
                startDate: Date;
            }[];
        } & {
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
        } & {
            reproductiveStatus: import("@prisma/client").$Enums.ReproductionState | null;
            reproductionAlerts: import("../../../reproduction/domain/reproduction-alerts").ReproductionAlert[];
            lactationStage: import("../../../reproduction/domain/lactation-stage").LactationStage | null;
            pregnancyStage: import("../../../reproduction/domain/pregnancy-stage").PregnancyStage | null;
            healthStatus: import("../../domain/health-status").DerivedHealthStatus;
            isQuarantined: boolean;
            quarantineUntil: Date | null;
            dim: number | null;
            animalCategory: "CALF" | "HEIFER" | "COW" | "BULL" | "STEER";
            lifecycleSubStage: string | null;
        })[];
    }>;
    downloadImportTemplate(res: Response): Promise<void>;
    importPreview(farmId: string, file: Express.Multer.File, dto: ImportPreviewDto): Promise<{
        importSessionId: `${string}-${string}-${string}-${string}-${string}`;
        total: number;
        ready: number;
        errors: number;
        rows: {
            row: number;
            name: string | null;
            tag: string | null;
            status: "error" | "ready";
            error: string | undefined;
        }[];
    }>;
    importConfirm(farmId: string, userId: string, dto: ImportConfirmDto): Promise<{
        imported: number;
        skipped: number;
    }>;
    profile(farmId: string, id: string): Promise<{
        age: {
            years: number;
            months: number;
        } | null;
        childrenCount: number;
        pregnancyStatus: string;
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
        reproductiveStatus: import("@prisma/client").$Enums.ReproductionState | null;
        reproductionAlerts: import("../../../reproduction/domain/reproduction-alerts").ReproductionAlert[];
        lactationStage: import("../../../reproduction/domain/lactation-stage").LactationStage | null;
        pregnancyStage: import("../../../reproduction/domain/pregnancy-stage").PregnancyStage | null;
        healthStatus: import("../../domain/health-status").DerivedHealthStatus;
        isQuarantined: boolean;
        quarantineUntil: Date | null;
        dim: number | null;
        animalCategory: "CALF" | "HEIFER" | "COW" | "BULL" | "STEER";
        lifecycleSubStage: string | null;
    }>;
    ancestry(farmId: string, id: string, query: AncestryQueryDto): Promise<unknown>;
    children(farmId: string, id: string): Promise<{
        name: string | null;
        id: string;
        tagNumber: string;
    }[]>;
    siblings(farmId: string, id: string): Promise<{
        name: string | null;
        id: string;
        tagNumber: string;
    }[]>;
    bcsHistory(farmId: string, id: string): Promise<{
        id: string;
        createdAt: Date;
        cattleId: string;
        notes: string | null;
        animalEventId: string | null;
        recordedDate: Date;
        recordedBy: string | null;
        score: number;
    }[]>;
    weightHistory(farmId: string, id: string): Promise<{
        id: string;
        createdAt: Date;
        cattleId: string;
        notes: string | null;
        animalEventId: string | null;
        recordedDate: Date;
        weightKg: number;
        recordedBy: string | null;
    }[]>;
    weightPeriodHistory(farmId: string, id: string, query: WeightHistoryQueryDto): Promise<{
        period: import("../../application/services/weight.service").WeightHistoryPeriod;
        points: import("../../application/services/weight.service").WeightHistoryPoint[];
    }>;
    getPhoto(farmId: string, id: string): Promise<import("../../../media/application/services/media.service").MediaUrls>;
    setPhoto(farmId: string, userId: string, id: string, file: Express.Multer.File): Promise<import("../../../media/application/services/media.service").MediaUrls>;
    removePhoto(farmId: string, userId: string, id: string): Promise<{
        removed: boolean;
    }>;
    overview(farmId: string, id: string): Promise<{
        aqr_score: number | null;
        aqr_change_pct: number | null;
        avg_daily_yield_7d: number;
        yield_change_pct: number | null;
        last_weight_kg: number;
        weight_change_pct: number | null;
        bcs_records: {
            date: Date;
            score: number;
        }[];
        weight_history: {
            date: Date;
            weight_kg: number;
        }[];
        lactation_curve: import("../../domain/lactation-curve").LactationCurvePoint[];
        lifetime_yield: {
            year: number;
            total_l: number;
        }[];
        recent_milk_records: {
            date: Date;
            morning_l: number;
            noon_l: number;
            evening_l: number;
            night_l: number;
            total_l: number;
        }[];
    }>;
    pedigree(farmId: string, id: string): Promise<{
        self: {
            dam: {
                id: string;
                name: string | null;
                tag: string;
                gender: string;
                farm_name: string | null;
                dam: unknown | null;
                sire: unknown | null;
            } | null;
            sire: {
                id: string;
                name: string | null;
                tag: string;
                gender: string;
                farm_name: string | null;
                dam: unknown | null;
                sire: unknown | null;
            } | {
                id: null;
                name: null;
                tag: null;
                gender: string;
                farm_name: null;
                is_external: boolean;
                dam: null;
                sire: null;
            } | null;
            id: string;
            name: string | null;
            tag: string;
            gender: string;
            farm_name: string | null;
        };
        dam: {
            id: string;
            name: string | null;
            tag: string;
            gender: string;
            farm_name: string | null;
            dam: unknown | null;
            sire: unknown | null;
        } | null;
        sire: {
            is_external: boolean;
            id: string;
            name: string | null;
            tag: string;
            gender: string;
            farm_name: string | null;
            dam: unknown | null;
            sire: unknown | null;
        } | {
            is_external: boolean;
            id: null;
            name: null;
            tag: null;
            gender: string;
            farm_name: null;
            dam: null;
            sire: null;
        };
        siblings: {
            relation: string;
            id: string;
            name: string | null;
            tag: string;
            gender: string;
            farm_name: string | null;
        }[];
        offspring: {
            id: string;
            name: string | null;
            tag: string;
            gender: import("@prisma/client").$Enums.CattleGender;
            birth_date: Date | null;
            farm_name: string;
        }[];
    }>;
    finance(farmId: string, id: string, query: CattleFinanceQueryDto): Promise<{
        period: string;
        total_income: number;
        total_cost: number;
        net_profit: number;
        expense_breakdown: Record<import("../../application/services/cattle-finance-aggregation").CattleExpenseBucket, number>;
        income_breakdown: {
            milk_sales: number;
            calf_sales: number;
        };
        monthly_chart: {
            month: string;
            income: number;
            cost: number;
        }[];
    }>;
    findOne(farmId: string, id: string): Promise<{
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
    } & {
        reproductiveStatus: import("@prisma/client").$Enums.ReproductionState | null;
        reproductionAlerts: import("../../../reproduction/domain/reproduction-alerts").ReproductionAlert[];
        lactationStage: import("../../../reproduction/domain/lactation-stage").LactationStage | null;
        pregnancyStage: import("../../../reproduction/domain/pregnancy-stage").PregnancyStage | null;
        healthStatus: import("../../domain/health-status").DerivedHealthStatus;
        isQuarantined: boolean;
        quarantineUntil: Date | null;
        dim: number | null;
        animalCategory: "CALF" | "HEIFER" | "COW" | "BULL" | "STEER";
        lifecycleSubStage: string | null;
    } & {
        profile_photo: import("../../../media/application/services/media.service").MediaUrls | null;
    }>;
    update(farmId: string, id: string, dto: UpdateCattleDto, userId: string): Promise<{
        breed: {
            name: string;
            farmId: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            deletedAt: Date | null;
        } | null;
        shed: {
            name: string;
            farmId: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            deletedAt: Date | null;
            code: string;
            capacity: number | null;
            purpose: import("@prisma/client").$Enums.ShedPurpose;
            responsibleMemberId: string | null;
        } | null;
        reproductionProfile: {
            reproductiveStatus: import("@prisma/client").$Enums.ReproductionState | null;
            totalCalvings: number;
            totalAbortions: number;
            lastCalvingDate: Date | null;
        } | null;
        healthCases: {
            status: import("@prisma/client").$Enums.HealthCaseStatus;
            careType: import("@prisma/client").$Enums.HealthCareType;
            isSafetyWithholdingActive: boolean;
            milkWithdrawalUntil: Date | null;
        }[];
        safetyWithdrawals: {
            milkWithdrawalUntil: Date | null;
            meatWithdrawalUntil: Date | null;
        }[];
        mother: {
            name: string | null;
            id: string;
            tagNumber: string;
        } | null;
        father: {
            name: string | null;
            id: string;
            tagNumber: string;
        } | null;
        heatEvents: {
            heatDateTime: Date;
        }[];
        breedingEvents: {
            status: import("@prisma/client").$Enums.BreedingStatus;
            breedingDate: Date;
            expectedPregnancyCheckDate: Date | null;
        }[];
        pregnancies: {
            expectedCalvingDate: Date | null;
            conceptionDate: Date | null;
        }[];
        dryPeriods: {
            id: string;
        }[];
        lactations: {
            startDate: Date;
        }[];
    } & {
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
    } & {
        reproductiveStatus: import("@prisma/client").$Enums.ReproductionState | null;
        reproductionAlerts: import("../../../reproduction/domain/reproduction-alerts").ReproductionAlert[];
        lactationStage: import("../../../reproduction/domain/lactation-stage").LactationStage | null;
        pregnancyStage: import("../../../reproduction/domain/pregnancy-stage").PregnancyStage | null;
        healthStatus: import("../../domain/health-status").DerivedHealthStatus;
        isQuarantined: boolean;
        quarantineUntil: Date | null;
        dim: number | null;
        animalCategory: "CALF" | "HEIFER" | "COW" | "BULL" | "STEER";
        lifecycleSubStage: string | null;
    }>;
    archive(farmId: string, id: string, userId: string): Promise<({
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
    } & {
        reproductiveStatus: import("@prisma/client").$Enums.ReproductionState | null;
        reproductionAlerts: import("../../../reproduction/domain/reproduction-alerts").ReproductionAlert[];
        lactationStage: import("../../../reproduction/domain/lactation-stage").LactationStage | null;
        pregnancyStage: import("../../../reproduction/domain/pregnancy-stage").PregnancyStage | null;
        healthStatus: import("../../domain/health-status").DerivedHealthStatus;
        isQuarantined: boolean;
        quarantineUntil: Date | null;
        dim: number | null;
        animalCategory: "CALF" | "HEIFER" | "COW" | "BULL" | "STEER";
        lifecycleSubStage: string | null;
    } & {
        profile_photo: import("../../../media/application/services/media.service").MediaUrls | null;
    }) | ({
        breed: {
            name: string;
            farmId: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            deletedAt: Date | null;
        } | null;
        shed: {
            name: string;
            farmId: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            deletedAt: Date | null;
            code: string;
            capacity: number | null;
            purpose: import("@prisma/client").$Enums.ShedPurpose;
            responsibleMemberId: string | null;
        } | null;
        reproductionProfile: {
            reproductiveStatus: import("@prisma/client").$Enums.ReproductionState | null;
            totalCalvings: number;
            totalAbortions: number;
            lastCalvingDate: Date | null;
        } | null;
        healthCases: {
            status: import("@prisma/client").$Enums.HealthCaseStatus;
            careType: import("@prisma/client").$Enums.HealthCareType;
            isSafetyWithholdingActive: boolean;
            milkWithdrawalUntil: Date | null;
        }[];
        safetyWithdrawals: {
            milkWithdrawalUntil: Date | null;
            meatWithdrawalUntil: Date | null;
        }[];
        mother: {
            name: string | null;
            id: string;
            tagNumber: string;
        } | null;
        father: {
            name: string | null;
            id: string;
            tagNumber: string;
        } | null;
        heatEvents: {
            heatDateTime: Date;
        }[];
        breedingEvents: {
            status: import("@prisma/client").$Enums.BreedingStatus;
            breedingDate: Date;
            expectedPregnancyCheckDate: Date | null;
        }[];
        pregnancies: {
            expectedCalvingDate: Date | null;
            conceptionDate: Date | null;
        }[];
        dryPeriods: {
            id: string;
        }[];
        lactations: {
            startDate: Date;
        }[];
    } & {
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
    } & {
        reproductiveStatus: import("@prisma/client").$Enums.ReproductionState | null;
        reproductionAlerts: import("../../../reproduction/domain/reproduction-alerts").ReproductionAlert[];
        lactationStage: import("../../../reproduction/domain/lactation-stage").LactationStage | null;
        pregnancyStage: import("../../../reproduction/domain/pregnancy-stage").PregnancyStage | null;
        healthStatus: import("../../domain/health-status").DerivedHealthStatus;
        isQuarantined: boolean;
        quarantineUntil: Date | null;
        dim: number | null;
        animalCategory: "CALF" | "HEIFER" | "COW" | "BULL" | "STEER";
        lifecycleSubStage: string | null;
    })>;
    restore(farmId: string, id: string): Promise<{
        breed: {
            name: string;
            farmId: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            deletedAt: Date | null;
        } | null;
        shed: {
            name: string;
            farmId: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            deletedAt: Date | null;
            code: string;
            capacity: number | null;
            purpose: import("@prisma/client").$Enums.ShedPurpose;
            responsibleMemberId: string | null;
        } | null;
        reproductionProfile: {
            reproductiveStatus: import("@prisma/client").$Enums.ReproductionState | null;
            totalCalvings: number;
            totalAbortions: number;
            lastCalvingDate: Date | null;
        } | null;
        healthCases: {
            status: import("@prisma/client").$Enums.HealthCaseStatus;
            careType: import("@prisma/client").$Enums.HealthCareType;
            isSafetyWithholdingActive: boolean;
            milkWithdrawalUntil: Date | null;
        }[];
        safetyWithdrawals: {
            milkWithdrawalUntil: Date | null;
            meatWithdrawalUntil: Date | null;
        }[];
        mother: {
            name: string | null;
            id: string;
            tagNumber: string;
        } | null;
        father: {
            name: string | null;
            id: string;
            tagNumber: string;
        } | null;
        heatEvents: {
            heatDateTime: Date;
        }[];
        breedingEvents: {
            status: import("@prisma/client").$Enums.BreedingStatus;
            breedingDate: Date;
            expectedPregnancyCheckDate: Date | null;
        }[];
        pregnancies: {
            expectedCalvingDate: Date | null;
            conceptionDate: Date | null;
        }[];
        dryPeriods: {
            id: string;
        }[];
        lactations: {
            startDate: Date;
        }[];
    } & {
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
    } & {
        reproductiveStatus: import("@prisma/client").$Enums.ReproductionState | null;
        reproductionAlerts: import("../../../reproduction/domain/reproduction-alerts").ReproductionAlert[];
        lactationStage: import("../../../reproduction/domain/lactation-stage").LactationStage | null;
        pregnancyStage: import("../../../reproduction/domain/pregnancy-stage").PregnancyStage | null;
        healthStatus: import("../../domain/health-status").DerivedHealthStatus;
        isQuarantined: boolean;
        quarantineUntil: Date | null;
        dim: number | null;
        animalCategory: "CALF" | "HEIFER" | "COW" | "BULL" | "STEER";
        lifecycleSubStage: string | null;
    }>;
    dispose(farmId: string, userId: string, id: string, dto: DisposeCattleDto): Promise<{
        date: Date;
        type: import("@prisma/client").$Enums.CattleDispositionType;
        farmId: string;
        id: string;
        createdAt: Date;
        reason: string | null;
        cattleId: string;
        createdById: string;
        saleId: string | null;
        animalEventId: string | null;
        price: import("@prisma/client/runtime/client").Decimal | null;
    }>;
    remove(farmId: string, id: string, dto: ArchiveCattleDto, userId: string): Promise<({
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
    } & {
        reproductiveStatus: import("@prisma/client").$Enums.ReproductionState | null;
        reproductionAlerts: import("../../../reproduction/domain/reproduction-alerts").ReproductionAlert[];
        lactationStage: import("../../../reproduction/domain/lactation-stage").LactationStage | null;
        pregnancyStage: import("../../../reproduction/domain/pregnancy-stage").PregnancyStage | null;
        healthStatus: import("../../domain/health-status").DerivedHealthStatus;
        isQuarantined: boolean;
        quarantineUntil: Date | null;
        dim: number | null;
        animalCategory: "CALF" | "HEIFER" | "COW" | "BULL" | "STEER";
        lifecycleSubStage: string | null;
    } & {
        profile_photo: import("../../../media/application/services/media.service").MediaUrls | null;
    }) | ({
        breed: {
            name: string;
            farmId: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            deletedAt: Date | null;
        } | null;
        shed: {
            name: string;
            farmId: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            deletedAt: Date | null;
            code: string;
            capacity: number | null;
            purpose: import("@prisma/client").$Enums.ShedPurpose;
            responsibleMemberId: string | null;
        } | null;
        reproductionProfile: {
            reproductiveStatus: import("@prisma/client").$Enums.ReproductionState | null;
            totalCalvings: number;
            totalAbortions: number;
            lastCalvingDate: Date | null;
        } | null;
        healthCases: {
            status: import("@prisma/client").$Enums.HealthCaseStatus;
            careType: import("@prisma/client").$Enums.HealthCareType;
            isSafetyWithholdingActive: boolean;
            milkWithdrawalUntil: Date | null;
        }[];
        safetyWithdrawals: {
            milkWithdrawalUntil: Date | null;
            meatWithdrawalUntil: Date | null;
        }[];
        mother: {
            name: string | null;
            id: string;
            tagNumber: string;
        } | null;
        father: {
            name: string | null;
            id: string;
            tagNumber: string;
        } | null;
        heatEvents: {
            heatDateTime: Date;
        }[];
        breedingEvents: {
            status: import("@prisma/client").$Enums.BreedingStatus;
            breedingDate: Date;
            expectedPregnancyCheckDate: Date | null;
        }[];
        pregnancies: {
            expectedCalvingDate: Date | null;
            conceptionDate: Date | null;
        }[];
        dryPeriods: {
            id: string;
        }[];
        lactations: {
            startDate: Date;
        }[];
    } & {
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
    } & {
        reproductiveStatus: import("@prisma/client").$Enums.ReproductionState | null;
        reproductionAlerts: import("../../../reproduction/domain/reproduction-alerts").ReproductionAlert[];
        lactationStage: import("../../../reproduction/domain/lactation-stage").LactationStage | null;
        pregnancyStage: import("../../../reproduction/domain/pregnancy-stage").PregnancyStage | null;
        healthStatus: import("../../domain/health-status").DerivedHealthStatus;
        isQuarantined: boolean;
        quarantineUntil: Date | null;
        dim: number | null;
        animalCategory: "CALF" | "HEIFER" | "COW" | "BULL" | "STEER";
        lifecycleSubStage: string | null;
    })>;
}
