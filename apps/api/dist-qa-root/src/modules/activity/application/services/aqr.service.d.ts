import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { AqrEventKey } from '../../domain/aqr-events';
import { AqrConfigService } from './aqr-config.service';
import { ActivityLogService, ActivityTaggedValue } from './activity-log.service';
export interface AqrEventResult {
    cattleId: string;
    eventKey: AqrEventKey;
    delta: number | null;
    aqrScore: number | null;
}
export interface ApplyEventOptions {
    actorId?: string | null;
    actionDetails?: string;
    taggedValues?: ActivityTaggedValue[];
}
export interface ReverseEventOptions {
    actorId?: string | null;
    actionDetails?: string;
    relative?: boolean;
}
export interface ReverseEventResult {
    cattleId: string;
    sourceEventTitle: string;
    delta: number;
    aqrScore: number;
}
export declare class AqrService {
    private readonly prisma;
    private readonly activityLog;
    private readonly config;
    private readonly log;
    constructor(prisma: PrismaService, activityLog: ActivityLogService, config: AqrConfigService, logger: LoggerService);
    applyEvent(farmId: string, cattleId: string, eventKey: AqrEventKey, options?: ApplyEventOptions): Promise<AqrEventResult>;
    reverseEvent(farmId: string, cattleId: string, activityLogId: string, options?: ReverseEventOptions): Promise<ReverseEventResult>;
    herdAqr(farmId: string): Promise<number>;
    private clamp;
}
