import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { RequirementSettingsService } from './requirement-settings.service';
import { type LookaheadEvent } from '../../domain/lookahead';
export declare class FeedLookaheadService {
    private readonly prisma;
    private readonly requirementSettings;
    constructor(prisma: PrismaService, requirementSettings: RequirementSettingsService);
    forCattle(farmId: string, cattleIds: string[], now: Date): Promise<Map<string, LookaheadEvent[]>>;
}
