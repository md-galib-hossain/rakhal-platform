import { AdminSubscriptionsService } from '../../application/services/admin-subscriptions.service';
import type { CurrentAdminContext } from '../../domain/authenticated-admin-request.type';
import { ActivateSubscriptionDto, CompSubscriptionDto, ExtendSubscriptionDto, SetPlanFeatureDto, SubscriptionActionDto, UpdatePlanDto } from '../dto/admin-subscription.dto';
export declare class AdminSubscriptionsController {
    private readonly subs;
    constructor(subs: AdminSubscriptionsService);
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
    updatePlan(admin: CurrentAdminContext, id: string, dto: UpdatePlanDto): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        monthlyPrice: import("@prisma/client/runtime/client").Decimal;
        yearlyPrice: import("@prisma/client/runtime/client").Decimal | null;
        maxFarmMembers: number | null;
        maxCattle: number | null;
        reportRetentionDays: number;
    }>;
    setFeature(admin: CurrentAdminContext, id: string, key: string, dto: SetPlanFeatureDto): Promise<{
        planId: string;
        feature: string;
        enabled: boolean;
        changed: boolean;
    }>;
    activate(admin: CurrentAdminContext, id: string, dto: ActivateSubscriptionDto): Promise<{
        farmId: string;
        plan: string;
        status: import("@prisma/client").$Enums.SubscriptionStatus;
        startsAt: Date;
        expiresAt: Date | null;
        cancelledAt: Date | null;
        changed: boolean;
    }>;
    comp(admin: CurrentAdminContext, id: string, dto: CompSubscriptionDto): Promise<{
        farmId: string;
        plan: string;
        status: import("@prisma/client").$Enums.SubscriptionStatus;
        startsAt: Date;
        expiresAt: Date | null;
        cancelledAt: Date | null;
        changed: boolean;
    }>;
    extend(admin: CurrentAdminContext, id: string, dto: ExtendSubscriptionDto): Promise<{
        farmId: string;
        plan: string;
        status: import("@prisma/client").$Enums.SubscriptionStatus;
        startsAt: Date;
        expiresAt: Date | null;
        cancelledAt: Date | null;
        changed: boolean;
    }>;
    cancel(admin: CurrentAdminContext, id: string, dto: SubscriptionActionDto): Promise<{
        farmId: string;
        plan: string;
        status: import("@prisma/client").$Enums.SubscriptionStatus;
        startsAt: Date;
        expiresAt: Date | null;
        cancelledAt: Date | null;
        changed: boolean;
    }>;
}
