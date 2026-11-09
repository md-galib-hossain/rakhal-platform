import { CalfService } from '../../application/services/calf.service';
import { ListCalfQueryDto } from '../dto/list-calf-query.dto';
import { RecordColostrumDto } from '../dto/record-colostrum.dto';
import { RecordMilkFeedingDto } from '../dto/record-milk-feeding.dto';
import { RecordStarterFeedDto } from '../dto/record-starter-feed.dto';
import { RecordWeightDto } from '../dto/record-weight.dto';
import { WeanCalfDto } from '../dto/wean-calf.dto';
export declare class CalfController {
    private readonly calfService;
    constructor(calfService: CalfService);
    list(farmId: string, query: ListCalfQueryDto): Promise<{
        items: {
            id: string;
            name: string | null;
            tagNumber: string;
            ageDays: number | null;
            gender: import("@prisma/client").$Enums.CattleGender;
            stage: import("../../domain/calf-stage").CalfStage | null;
            dam: {
                id: string;
                name: string | null;
                tagNumber: string;
            } | null;
            birthWeightKg: number | null;
            currentWeightKg: number | null;
            adgKgDay: number | null;
            healthStatus: string;
            fedToday: boolean;
            weaningDueDate: Date | null;
        }[];
        meta: {
            kpis: {
                totalCalves: number;
                fedToday: number;
                healthConcern: number;
                weaningDueThisWeek: number;
            };
            count: number;
            limit: number;
            hasNextPage: boolean;
            hasPreviousPage: boolean;
            startCursor: string | null;
            endCursor: string | null;
        };
    }>;
    profile(farmId: string, id: string): Promise<{
        id: string;
        name: string | null;
        tagNumber: string;
        birthDate: Date | null;
        ageDays: number | null;
        gender: import("@prisma/client").$Enums.CattleGender;
        dam: {
            name: string | null;
            id: string;
            tagNumber: string;
        } | null;
        birthWeightKg: number | null;
        birthEaseScore: import("@prisma/client").$Enums.CalvingEase | null;
        colostrumRecords: {
            id: string;
            createdAt: Date;
            notes: string | null;
            quality: import("@prisma/client").$Enums.ColostrumQuality;
            calfId: string;
            feedNumber: number;
            fedAt: Date;
            volumeMl: number;
            fedBy: string | null;
        }[];
        totalColostrum24hMl: number;
        milkFeedingLog: {
            totalMl: number;
            date: Date;
            type: import("@prisma/client").$Enums.CalfMilkType;
            id: string;
            createdAt: Date;
            notes: string | null;
            calfId: string;
            morningMl: number;
            eveningMl: number;
        }[];
        weightRecords: {
            date: Date;
            weightKg: number;
            adgToDate: number | null;
        }[];
        starterFeed: {
            firstOfferedDate: Date | null;
            firstIntakeDate: Date | null;
            currentDailyIntakeG: number | null;
        };
        weaningTargetDate: Date | null;
        weaningWeightTargetKg: number;
        weaningStatus: string;
        weaningRecord: {
            id: string;
            createdAt: Date;
            notes: string | null;
            calfId: string;
            weaningDate: Date;
            weaningWeightKg: number | null;
            adgAtWeaning: number | null;
            animalEventId: string | null;
        } | null;
        upcomingTasks: {
            name: string;
            id: string;
            category: import("@prisma/client").$Enums.TaskCategory;
            dueAt: Date;
        }[];
    }>;
    colostrum(farmId: string, id: string, dto: RecordColostrumDto): Promise<{
        id: string;
        createdAt: Date;
        notes: string | null;
        quality: import("@prisma/client").$Enums.ColostrumQuality;
        calfId: string;
        feedNumber: number;
        fedAt: Date;
        volumeMl: number;
        fedBy: string | null;
    }>;
    milkFeeding(farmId: string, id: string, dto: RecordMilkFeedingDto): Promise<{
        totalMl: number;
        date: Date;
        type: import("@prisma/client").$Enums.CalfMilkType;
        id: string;
        createdAt: Date;
        notes: string | null;
        calfId: string;
        morningMl: number;
        eveningMl: number;
    }>;
    weight(farmId: string, userId: string, id: string, dto: RecordWeightDto): Promise<{
        adgToDate: number | null;
        id: string;
        createdAt: Date;
        notes: string | null;
        calfId: string;
        animalEventId: string | null;
        weightKg: number;
        recordedBy: string | null;
        measuredDate: Date;
    }>;
    starterFeed(farmId: string, id: string, dto: RecordStarterFeedDto): Promise<{
        date: Date;
        id: string;
        createdAt: Date;
        eventType: import("@prisma/client").$Enums.CalfStarterEventType;
        notes: string | null;
        calfId: string;
        amountG: number;
    }>;
    wean(farmId: string, id: string, dto: WeanCalfDto): Promise<{
        calfId: string;
        weaned: boolean;
        adgAtWeaning: number | null;
        productionStatusUpdatedTo: string | null;
        movedToCattleModule: boolean;
        removedFromCalfManagement: boolean;
        weaningRecord: {
            id: string;
            createdAt: Date;
            notes: string | null;
            calfId: string;
            weaningDate: Date;
            weaningWeightKg: number | null;
            adgAtWeaning: number | null;
            animalEventId: string | null;
        };
    }>;
}
