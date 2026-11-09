import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { SubscriptionAccessService } from '../../application/services/subscription-access.service';
export declare class SubscriptionController {
    private readonly access;
    private readonly prisma;
    constructor(access: SubscriptionAccessService, prisma: PrismaService);
    get(farmId: string): Promise<{
        status: import("../../application/services/subscription-access.service").EffectiveStatus;
        plan_id: string | null;
        plan_name: string | null;
        expires_at: string | null;
        features: string[];
        limits: {
            max_cattle: number | null;
            max_farm_members: number | null;
        };
        usage: {
            cattle: number;
            farm_members: number;
        };
        pending_plan_id: string | null;
        pending_plan_name: string | null;
        pending_effective_at: string | null;
    }>;
}
