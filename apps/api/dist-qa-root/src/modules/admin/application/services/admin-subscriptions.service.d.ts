import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { SubscriptionAccessService } from 'src/modules/subscription/application/services/subscription-access.service';
import { SubscriptionLifecycleService } from 'src/modules/subscription/application/services/subscription-lifecycle.service';
import { ActivateSubscriptionDto, CompSubscriptionDto, ExtendSubscriptionDto, SetPlanFeatureDto, SubscriptionActionDto, UpdatePlanDto } from '../../presentation/dto/admin-subscription.dto';
import { AdminAuditService } from './admin-audit.service';
export declare class AdminSubscriptionsService {
    private readonly prisma;
    private readonly lifecycle;
    private readonly access;
    private readonly audit;
    constructor(prisma: PrismaService, lifecycle: SubscriptionLifecycleService, access: SubscriptionAccessService, audit: AdminAuditService);
    matrix(): Promise<{
        features: {
            id: string;
            createdAt: Date;
            description: string | null;
            key: string;
        }[];
        plans: {
            id: string;
            name: string;
            description: string | null;
            monthlyPrice: number;
            yearlyPrice: number | null;
            maxCattle: number | null;
            maxFarmMembers: number | null;
            farmCount: number;
            enabledFeatures: string[];
        }[];
    }>;
    updatePlan(actorId: string, id: string, dto: UpdatePlanDto): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        monthlyPrice: Prisma.Decimal;
        yearlyPrice: Prisma.Decimal | null;
        maxFarmMembers: number | null;
        maxCattle: number | null;
        reportRetentionDays: number;
    }>;
    setPlanFeature(actorId: string, planId: string, featureKey: string, dto: SetPlanFeatureDto): Promise<{
        planId: string;
        feature: string;
        enabled: boolean;
        changed: boolean;
    }>;
    activate(actorId: string, farmId: string, dto: ActivateSubscriptionDto): Promise<{
        farmId: string;
        plan: string;
        status: import("@prisma/client").$Enums.SubscriptionStatus;
        startsAt: Date;
        expiresAt: Date | null;
        cancelledAt: Date | null;
        changed: boolean;
    }>;
    comp(actorId: string, farmId: string, dto: CompSubscriptionDto): Promise<{
        farmId: string;
        plan: string;
        status: import("@prisma/client").$Enums.SubscriptionStatus;
        startsAt: Date;
        expiresAt: Date | null;
        cancelledAt: Date | null;
        changed: boolean;
    }>;
    extend(actorId: string, farmId: string, dto: ExtendSubscriptionDto): Promise<{
        farmId: string;
        plan: string;
        status: import("@prisma/client").$Enums.SubscriptionStatus;
        startsAt: Date;
        expiresAt: Date | null;
        cancelledAt: Date | null;
        changed: boolean;
    }>;
    cancel(actorId: string, farmId: string, dto: SubscriptionActionDto): Promise<{
        farmId: string;
        plan: string;
        status: import("@prisma/client").$Enums.SubscriptionStatus;
        startsAt: Date;
        expiresAt: Date | null;
        cancelledAt: Date | null;
        changed: boolean;
    }>;
    private farm;
    private latest;
    private getPlan;
    private invalidatePlanFarms;
    private record;
    private view;
}
