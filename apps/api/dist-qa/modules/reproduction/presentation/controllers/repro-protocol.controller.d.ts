import { ReproProtocolService } from '../../application/services/repro-protocol.service';
import { ApplyProtocolDto, CloseInstanceDto, CreateProtocolDto, ListInstanceQueryDto, ListProtocolQueryDto, RecordAiDto, RecordOutcomeDto, UpdateProtocolDto } from '../dto/protocol.dto';
export declare class ReproProtocolController {
    private readonly protocols;
    constructor(protocols: ReproProtocolService);
    list(farmId: string, query: ListProtocolQueryDto): Promise<{
        items: {
            id: string;
            name: string;
            code: string | null;
            description: string | null;
            duration_days: number;
            step_count: number;
            is_system_default: boolean;
            editable: boolean;
            metrics: import("../../domain/protocol-metrics").ProtocolMetrics;
        }[];
        meta: import("../../../../common/pagination").CursorPageMeta;
    }>;
    create(farmId: string, userId: string, dto: CreateProtocolDto): Promise<{
        id: string;
        name: string;
        code: string | null;
        description: string | null;
        duration_days: number;
        is_system_default: boolean;
        steps: {
            day_number: number;
            title: string;
            step_type: import("@prisma/client").$Enums.ReproStepType;
            instruction: string | null;
            is_required: boolean;
        }[];
    }>;
    kpis(farmId: string): Promise<{
        total_applied: number;
        in_progress: number;
        completed: number;
        ai_completed: number;
        pregnant: number;
        open: number;
        pregnancy_loss: number;
        conception_rate: number | null;
        pregnancy_loss_rate: number | null;
    }>;
    listInstances(farmId: string, query: ListInstanceQueryDto): Promise<{
        items: {
            id: string;
            protocol_id: string;
            protocol_name: string;
            cattle_id: string;
            start_date: Date;
            status: import("@prisma/client").$Enums.ReproProtocolStatus;
            current_step_day: number | null;
            ai_completed_at: Date | null;
            pregnancy_outcome: import("@prisma/client").$Enums.ReproPregnancyOutcome | null;
            outcome_recorded_at: Date | null;
            completed_at: Date | null;
            end_reason: string | null;
            notes: string | null;
            created_at: Date;
        }[];
        meta: import("../../../../common/pagination").CursorPageMeta;
    }>;
    getInstance(farmId: string, id: string): Promise<{
        id: string;
        protocol_id: string;
        protocol_name: string;
        cattle_id: string;
        start_date: Date;
        status: import("@prisma/client").$Enums.ReproProtocolStatus;
        current_step_day: number | null;
        ai_completed_at: Date | null;
        pregnancy_outcome: import("@prisma/client").$Enums.ReproPregnancyOutcome | null;
        outcome_recorded_at: Date | null;
        completed_at: Date | null;
        end_reason: string | null;
        notes: string | null;
        created_at: Date;
    }>;
    apply(farmId: string, userId: string, dto: ApplyProtocolDto): Promise<{
        protocol_id: string;
        applied: number;
        tasks_created: number;
        instance_ids: string[];
    }>;
    recordAi(farmId: string, userId: string, id: string, dto: RecordAiDto): Promise<{
        id: string;
        protocol_id: string;
        protocol_name: string;
        cattle_id: string;
        start_date: Date;
        status: import("@prisma/client").$Enums.ReproProtocolStatus;
        current_step_day: number | null;
        ai_completed_at: Date | null;
        pregnancy_outcome: import("@prisma/client").$Enums.ReproPregnancyOutcome | null;
        outcome_recorded_at: Date | null;
        completed_at: Date | null;
        end_reason: string | null;
        notes: string | null;
        created_at: Date;
    }>;
    recordOutcome(farmId: string, userId: string, id: string, dto: RecordOutcomeDto): Promise<{
        id: string;
        protocol_id: string;
        protocol_name: string;
        cattle_id: string;
        start_date: Date;
        status: import("@prisma/client").$Enums.ReproProtocolStatus;
        current_step_day: number | null;
        ai_completed_at: Date | null;
        pregnancy_outcome: import("@prisma/client").$Enums.ReproPregnancyOutcome | null;
        outcome_recorded_at: Date | null;
        completed_at: Date | null;
        end_reason: string | null;
        notes: string | null;
        created_at: Date;
    }>;
    closeInstance(farmId: string, userId: string, id: string, dto: CloseInstanceDto): Promise<{
        id: string;
        protocol_id: string;
        protocol_name: string;
        cattle_id: string;
        start_date: Date;
        status: import("@prisma/client").$Enums.ReproProtocolStatus;
        current_step_day: number | null;
        ai_completed_at: Date | null;
        pregnancy_outcome: import("@prisma/client").$Enums.ReproPregnancyOutcome | null;
        outcome_recorded_at: Date | null;
        completed_at: Date | null;
        end_reason: string | null;
        notes: string | null;
        created_at: Date;
    }>;
    getProtocol(farmId: string, id: string): Promise<{
        id: string;
        name: string;
        code: string | null;
        description: string | null;
        duration_days: number;
        is_system_default: boolean;
        steps: {
            day_number: number;
            title: string;
            step_type: import("@prisma/client").$Enums.ReproStepType;
            instruction: string | null;
            is_required: boolean;
        }[];
    }>;
    update(farmId: string, id: string, dto: UpdateProtocolDto): Promise<{
        id: string;
        name: string;
        code: string | null;
        description: string | null;
        duration_days: number;
        is_system_default: boolean;
        steps: {
            day_number: number;
            title: string;
            step_type: import("@prisma/client").$Enums.ReproStepType;
            instruction: string | null;
            is_required: boolean;
        }[];
    }>;
    remove(farmId: string, id: string): Promise<{
        deleted: boolean;
    }>;
}
