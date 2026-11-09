import { FeedConcentration } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { FeedPlanResolverService } from './feed-plan-resolver.service';
export type RationMatchLevel = 'INDIVIDUAL' | 'GROUP' | 'HERD';
export interface ResolvedRation {
    concentration: FeedConcentration;
    matchLevel: RationMatchLevel;
}
export declare class FeedRationResolverService {
    private readonly prisma;
    private readonly plans;
    constructor(prisma: PrismaService, plans: FeedPlanResolverService);
    resolveActiveRation(farmId: string, cattleId: string): Promise<ResolvedRation | null>;
}
