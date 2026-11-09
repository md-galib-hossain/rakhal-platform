import { BillingPeriod, FarmSubscription, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { TransactionalEmailService } from 'src/modules/email/application/services/transactional-email.service';
import { SubscriptionAccessService } from './subscription-access.service';
interface ProvisionOptions {
    planName: string;
    status: SubscriptionStatus;
    durationDays: number | null;
}
export declare class SubscriptionLifecycleService {
    private readonly prisma;
    private readonly access;
    private readonly txEmail;
    private readonly log;
    constructor(prisma: PrismaService, access: SubscriptionAccessService, txEmail: TransactionalEmailService, logger: LoggerService);
    provision(farmId: string, opts: ProvisionOptions): Promise<FarmSubscription | null>;
    provisionTrial(farmId: string): Promise<FarmSubscription | null>;
    ensureUsableSubscription(farmId: string): Promise<FarmSubscription | null>;
    private downgradeToFree;
    runExpirySweep(now?: Date): Promise<{
        pastDue: number;
        expired: number;
        downgraded: number;
    }>;
    private sendExpiryEmails;
    activate(farmId: string, planId: string, period: BillingPeriod): Promise<FarmSubscription>;
}
export {};
