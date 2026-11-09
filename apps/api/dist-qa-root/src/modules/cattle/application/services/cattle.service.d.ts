import { Cattle, CattleDispositionType, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { AqrService } from 'src/modules/activity/application/services/aqr.service';
import { SubscriptionAccessService } from 'src/modules/subscription/application/services/subscription-access.service';
import { FarmSettingsService } from 'src/modules/farm-settings/farm-settings.service';
import { TaskService } from 'src/modules/task/application/services/task.service';
import { AnimalHoldService } from './animal-hold.service';
import { AnimalUpcomingEventsService } from './animal-upcoming-events.service';
import { AnimalEventWriteService } from 'src/modules/animal-events/application/services/animal-event-write.service';
import { EligibilityService } from 'src/modules/animal-events/application/services/eligibility.service';
import { MediaService, type MediaUrls } from 'src/modules/media/application/services/media.service';
import { type ReproductionAlert } from 'src/modules/reproduction/domain/reproduction-alerts';
import { type LactationStage } from 'src/modules/reproduction/domain/lactation-stage';
import { type PregnancyStage } from 'src/modules/reproduction/domain/pregnancy-stage';
import { ReproductionDerivationService } from 'src/modules/reproduction/application/services/reproduction-derivation.service';
import { ReproductionService } from 'src/modules/reproduction/application/services/reproduction.service';
import { AncestryQueryDto } from '../../presentation/dto/ancestry-query.dto';
import { ArchiveCattleDto } from '../../presentation/dto/archive-cattle.dto';
import { BulkCattleDto } from '../../presentation/dto/bulk-cattle.dto';
import { CreateCattleDto } from '../../presentation/dto/create-cattle.dto';
import { ListCattleQueryDto } from '../../presentation/dto/list-cattle-query.dto';
import { UpcomingEventsQueryDto } from '../../presentation/dto/upcoming-events-query.dto';
import { UpdateCattleDto } from '../../presentation/dto/update-cattle.dto';
type CattleSummary = Pick<Cattle, 'id' | 'name' | 'tagNumber'>;
interface AncestryNode extends CattleSummary {
    mother: AncestryNode | null;
    father: AncestryNode | null;
}
export interface RecordCattleDispositionInput {
    type: CattleDispositionType;
    saleId?: string | null;
    date: Date;
    price?: Prisma.Decimal | number | string | null;
    reason?: string | null;
}
export declare class CattleService {
    private readonly prisma;
    private readonly aqrService;
    private readonly subscriptionAccess;
    private readonly media;
    private readonly farmSettings;
    private readonly derivation;
    private readonly reproductionService;
    private readonly taskService;
    private readonly animalHoldService;
    private readonly logger;
    private readonly upcomingEventsService;
    private readonly eligibility?;
    private readonly eventWriter?;
    private readonly log;
    constructor(prisma: PrismaService, aqrService: AqrService, subscriptionAccess: SubscriptionAccessService, media: MediaService, farmSettings: FarmSettingsService, derivation: ReproductionDerivationService, reproductionService: ReproductionService, taskService: TaskService, animalHoldService: AnimalHoldService, logger: LoggerService, upcomingEventsService: AnimalUpcomingEventsService, eligibility?: EligibilityService | undefined, eventWriter?: AnimalEventWriteService | undefined);
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
        reproductionAlerts: ReproductionAlert[];
        lactationStage: LactationStage | null;
        pregnancyStage: PregnancyStage | null;
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
            reproductionAlerts: ReproductionAlert[];
            lactationStage: LactationStage | null;
            pregnancyStage: PregnancyStage | null;
            healthStatus: import("../../domain/health-status").DerivedHealthStatus;
            isQuarantined: boolean;
            quarantineUntil: Date | null;
            dim: number | null;
            animalCategory: "CALF" | "HEIFER" | "COW" | "BULL" | "STEER";
            lifecycleSubStage: string | null;
        } & {
            profile_photo: MediaUrls | null;
        })[];
        meta: import("src/common/pagination").CursorPageMeta;
    }>;
    findUpcomingEvents(farmId: string, id: string, query: UpcomingEventsQueryDto): Promise<import("./animal-upcoming-events.service").AnimalUpcomingEventsResult>;
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
        reproductionAlerts: ReproductionAlert[];
        lactationStage: LactationStage | null;
        pregnancyStage: PregnancyStage | null;
        healthStatus: import("../../domain/health-status").DerivedHealthStatus;
        isQuarantined: boolean;
        quarantineUntil: Date | null;
        dim: number | null;
        animalCategory: "CALF" | "HEIFER" | "COW" | "BULL" | "STEER";
        lifecycleSubStage: string | null;
    } & {
        profile_photo: MediaUrls | null;
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
        reproductionAlerts: ReproductionAlert[];
        lactationStage: LactationStage | null;
        pregnancyStage: PregnancyStage | null;
        healthStatus: import("../../domain/health-status").DerivedHealthStatus;
        isQuarantined: boolean;
        quarantineUntil: Date | null;
        dim: number | null;
        animalCategory: "CALF" | "HEIFER" | "COW" | "BULL" | "STEER";
        lifecycleSubStage: string | null;
    }>;
    archive(farmId: string, id: string, userId: string): Promise<({
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
        reproductionAlerts: ReproductionAlert[];
        lactationStage: LactationStage | null;
        pregnancyStage: PregnancyStage | null;
        healthStatus: import("../../domain/health-status").DerivedHealthStatus;
        isQuarantined: boolean;
        quarantineUntil: Date | null;
        dim: number | null;
        animalCategory: "CALF" | "HEIFER" | "COW" | "BULL" | "STEER";
        lifecycleSubStage: string | null;
    }) | ({
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
        reproductionAlerts: ReproductionAlert[];
        lactationStage: LactationStage | null;
        pregnancyStage: PregnancyStage | null;
        healthStatus: import("../../domain/health-status").DerivedHealthStatus;
        isQuarantined: boolean;
        quarantineUntil: Date | null;
        dim: number | null;
        animalCategory: "CALF" | "HEIFER" | "COW" | "BULL" | "STEER";
        lifecycleSubStage: string | null;
    } & {
        profile_photo: MediaUrls | null;
    })>;
    private static readonly ARCHIVE_REASON_TO_DISPOSITION;
    archiveWithReason(farmId: string, id: string, dto: ArchiveCattleDto, userId: string): Promise<({
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
        reproductionAlerts: ReproductionAlert[];
        lactationStage: LactationStage | null;
        pregnancyStage: PregnancyStage | null;
        healthStatus: import("../../domain/health-status").DerivedHealthStatus;
        isQuarantined: boolean;
        quarantineUntil: Date | null;
        dim: number | null;
        animalCategory: "CALF" | "HEIFER" | "COW" | "BULL" | "STEER";
        lifecycleSubStage: string | null;
    }) | ({
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
        reproductionAlerts: ReproductionAlert[];
        lactationStage: LactationStage | null;
        pregnancyStage: PregnancyStage | null;
        healthStatus: import("../../domain/health-status").DerivedHealthStatus;
        isQuarantined: boolean;
        quarantineUntil: Date | null;
        dim: number | null;
        animalCategory: "CALF" | "HEIFER" | "COW" | "BULL" | "STEER";
        lifecycleSubStage: string | null;
    } & {
        profile_photo: MediaUrls | null;
    })>;
    recordDisposition(farmId: string, userId: string, cattleId: string, dto: RecordCattleDispositionInput, tx?: Prisma.TransactionClient): Promise<{
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
        price: Prisma.Decimal | null;
    }>;
    cleanupOnDisposition(farmId: string, cattleId: string, userId: string, type: CattleDispositionType): Promise<void>;
    recordDispositionWithClient(client: Prisma.TransactionClient, farmId: string, userId: string, cattleId: string, dto: RecordCattleDispositionInput): Promise<{
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
        price: Prisma.Decimal | null;
    }>;
    undoDisposition(farmId: string, cattleId: string, tx?: Prisma.TransactionClient): Promise<void>;
    private closeActiveLactation;
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
        reproductionAlerts: ReproductionAlert[];
        lactationStage: LactationStage | null;
        pregnancyStage: PregnancyStage | null;
        healthStatus: import("../../domain/health-status").DerivedHealthStatus;
        isQuarantined: boolean;
        quarantineUntil: Date | null;
        dim: number | null;
        animalCategory: "CALF" | "HEIFER" | "COW" | "BULL" | "STEER";
        lifecycleSubStage: string | null;
    }>;
    remove(farmId: string, id: string, dto: ArchiveCattleDto | undefined, userId: string): Promise<({
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
        reproductionAlerts: ReproductionAlert[];
        lactationStage: LactationStage | null;
        pregnancyStage: PregnancyStage | null;
        healthStatus: import("../../domain/health-status").DerivedHealthStatus;
        isQuarantined: boolean;
        quarantineUntil: Date | null;
        dim: number | null;
        animalCategory: "CALF" | "HEIFER" | "COW" | "BULL" | "STEER";
        lifecycleSubStage: string | null;
    }) | ({
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
        reproductionAlerts: ReproductionAlert[];
        lactationStage: LactationStage | null;
        pregnancyStage: PregnancyStage | null;
        healthStatus: import("../../domain/health-status").DerivedHealthStatus;
        isQuarantined: boolean;
        quarantineUntil: Date | null;
        dim: number | null;
        animalCategory: "CALF" | "HEIFER" | "COW" | "BULL" | "STEER";
        lifecycleSubStage: string | null;
    } & {
        profile_photo: MediaUrls | null;
    })>;
    highlights(farmId: string): Promise<{
        total_active: number;
        total_change_pct: number | null;
        avg_herd_aqr: number;
        aqr_change_pct: number | null;
        breeding_ready_count: number;
        todays_yield_l: number;
        yield_change_pct: number | null;
    }>;
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
            reproductionAlerts: ReproductionAlert[];
            lactationStage: LactationStage | null;
            pregnancyStage: PregnancyStage | null;
            healthStatus: import("../../domain/health-status").DerivedHealthStatus;
            isQuarantined: boolean;
            quarantineUntil: Date | null;
            dim: number | null;
            animalCategory: "CALF" | "HEIFER" | "COW" | "BULL" | "STEER";
            lifecycleSubStage: string | null;
        })[];
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
        reproductionAlerts: ReproductionAlert[];
        lactationStage: LactationStage | null;
        pregnancyStage: PregnancyStage | null;
        healthStatus: import("../../domain/health-status").DerivedHealthStatus;
        isQuarantined: boolean;
        quarantineUntil: Date | null;
        dim: number | null;
        animalCategory: "CALF" | "HEIFER" | "COW" | "BULL" | "STEER";
        lifecycleSubStage: string | null;
    }>;
    ancestry(farmId: string, id: string, query: AncestryQueryDto): Promise<AncestryNode | null>;
    children(farmId: string, id: string): Promise<{
        name: string | null;
        id: string;
        tagNumber: string;
    }[]>;
    recordWeight(farmId: string, userId: string, id: string, dto: {
        weightKg: number;
        date: string;
        notes?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        cattleId: string;
        notes: string | null;
        animalEventId: string | null;
        recordedDate: Date;
        weightKg: number;
        recordedBy: string | null;
    }>;
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
    tabReproduction(farmId: string, id: string): Promise<{
        total_calvings: number;
        avg_calving_interval_days: number | null;
        conception_rate_pct: number | null;
        services_per_conception: number | null;
        current_dim: number | null;
        vwp_end_date: string | null;
        reproductive_status: import("@prisma/client").$Enums.ReproductionState | null;
        heat_history: {
            id: string;
            date: string;
            type: string;
            detection_method: import("@prisma/client").$Enums.HeatDetectionMethod;
        }[];
        ai_history: {
            id: string;
            date: string;
            inseminator: string | null;
            outcome: import("@prisma/client").$Enums.BreedingStatus;
            pregnancy_confirmed_on: string | null;
        }[];
        calving_history: {
            id: string;
            date: string;
            ease_score: import("@prisma/client").$Enums.CalvingEase;
            calf: {
                id: string;
                tag: string;
                name: string | null;
                gender: import("@prisma/client").$Enums.CattleGender;
                birth_date: string | null;
            } | null;
        }[];
    }>;
    tabHealth(farmId: string, id: string): Promise<{
        active_cases: {
            id: string;
            diagnosis: string | null;
            priority: import("@prisma/client").$Enums.HealthPriority;
            status: import("@prisma/client").$Enums.HealthCaseStatus;
            opened_at: string;
            withholding_active: boolean;
            withholding_end_date: string | null;
        }[];
        treatment_history: {
            id: string;
            diagnosis: string | null;
            status: import("@prisma/client").$Enums.HealthCaseStatus;
            opened_at: string;
            closed_at: string | null;
        }[];
        vaccination_history: unknown[];
        bcs_trend: {
            date: string;
            score: number;
            alert: string | null;
        }[];
    }>;
    siblings(farmId: string, id: string): Promise<{
        name: string | null;
        id: string;
        tagNumber: string;
    }[]>;
    setProfilePhoto(farmId: string, userId: string, id: string, file: {
        buffer: Buffer;
        originalname?: string;
        size?: number;
    }): Promise<MediaUrls>;
    removeProfilePhoto(farmId: string, userId: string, id: string): Promise<{
        removed: boolean;
    }>;
    getProfilePhoto(farmId: string, id: string): Promise<MediaUrls>;
    private attachListPhotos;
    private attachDetailPhoto;
    private composeStatus;
    private lifecycleBoundaries;
    private buildReproductionContext;
    private healthStatusWhere;
    private dailyYield;
    private bulkResult;
    private assertShedInFarm;
    private pctChange;
    private round;
    private validateReferences;
    private validateParentRules;
    private isDescendant;
    private buildAncestry;
    private getCattleOrThrow;
    private defaultInclude;
    private summarySelect;
    private calculateAge;
    private daysBetween;
    private laterDate;
    private addDays;
    private nextHealthCaseCode;
    private isUniqueError;
}
export {};
