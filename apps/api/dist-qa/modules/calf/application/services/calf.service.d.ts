import { CattleGender } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { TaskService } from 'src/modules/task/application/services/task.service';
import { ListCalfQueryDto } from '../../presentation/dto/list-calf-query.dto';
import { RecordColostrumDto } from '../../presentation/dto/record-colostrum.dto';
import { RecordMilkFeedingDto } from '../../presentation/dto/record-milk-feeding.dto';
import { RecordStarterFeedDto } from '../../presentation/dto/record-starter-feed.dto';
import { RecordWeightDto } from '../../presentation/dto/record-weight.dto';
import { WeanCalfDto } from '../../presentation/dto/wean-calf.dto';
type CalfSummary = {
    id: string;
    name: string | null;
    tagNumber: string;
};
export declare class CalfService {
    private readonly prisma;
    private readonly taskService;
    private readonly log;
    constructor(prisma: PrismaService, taskService: TaskService, logger: LoggerService);
    scheduleCareReminders(input: {
        farmId: string;
        createdBy: string;
        calfId: string;
        birthDate: Date;
        gender: CattleGender;
        sourceEventId?: string;
    }): Promise<number>;
    list(farmId: string, query: ListCalfQueryDto): Promise<{
        items: {
            id: string;
            name: string | null;
            tagNumber: string;
            ageDays: number | null;
            gender: import("@prisma/client").$Enums.CattleGender;
            stage: import("../../domain/calf-stage").CalfStage | null;
            dam: CalfSummary | null;
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
    recordColostrum(farmId: string, id: string, dto: RecordColostrumDto): Promise<{
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
    recordMilkFeeding(farmId: string, id: string, dto: RecordMilkFeedingDto): Promise<{
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
    recordWeight(farmId: string, userId: string, id: string, dto: RecordWeightDto): Promise<{
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
    recordStarterFeed(farmId: string, id: string, dto: RecordStarterFeedDto): Promise<{
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
    private dashboardKpis;
    private enrichCalves;
    private birthWeight;
    private assertCalf;
    private getCattleOrThrow;
    private summarySelect;
}
export {};
