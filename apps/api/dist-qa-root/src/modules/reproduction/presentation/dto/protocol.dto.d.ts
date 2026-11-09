import { ReproStepType } from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
export declare class StepScheduleOverrideDto {
    dayNumber: number;
    stepId?: string;
    dueAt: string;
}
export declare class ApplyProtocolDto {
    protocolId: string;
    cattleIds: string[];
    startDate?: string;
    stepOverrides?: StepScheduleOverrideDto[];
}
export declare class RecordAiDto {
    semenBatchId?: string;
    inseminator?: string;
    aiDate?: string;
    notes?: string;
}
export declare class RecordOutcomeDto {
    outcome: 'PREGNANT' | 'OPEN' | 'PREGNANCY_LOSS';
    notes?: string;
}
export declare class CloseInstanceDto {
    status: 'CANCELLED' | 'FAILED';
    reason?: string;
}
export declare class ProtocolStepDto {
    dayNumber: number;
    title: string;
    stepType: ReproStepType;
    instruction?: string;
    isRequired?: boolean;
}
export declare class CreateProtocolDto {
    name: string;
    description?: string;
    steps: ProtocolStepDto[];
}
export declare class UpdateProtocolDto {
    name?: string;
    description?: string;
    steps?: ProtocolStepDto[];
}
export declare class ListProtocolQueryDto extends CursorPaginationQueryDto {
}
export declare class ListInstanceQueryDto extends CursorPaginationQueryDto {
    protocolId?: string;
    cattleId?: string;
    status?: string;
}
