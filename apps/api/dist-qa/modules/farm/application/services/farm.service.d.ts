import { Farm } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { TrialAbuseService } from 'src/modules/support/application/services/trial-abuse.service';
import { SubscriptionLifecycleService } from 'src/modules/subscription/application/services/subscription-lifecycle.service';
import { ReferralService } from 'src/modules/billing/application/services/referral.service';
import { LegalConsentService } from 'src/modules/compliance/application/services/legal-consent.service';
import { TransactionalEmailService } from 'src/modules/email/application/services/transactional-email.service';
import { LedgerAccountService } from 'src/modules/finance-v2/ledger/application/ledger-account.service';
import { CreateFarmDto } from '../../presentation/dto/create-farm.dto';
export declare class FarmService {
    private readonly prisma;
    private readonly trialAbuse;
    private readonly subscriptionLifecycle;
    private readonly referrals;
    private readonly legal;
    private readonly txEmail;
    private readonly ledgerAccounts;
    private readonly log;
    constructor(prisma: PrismaService, trialAbuse: TrialAbuseService, subscriptionLifecycle: SubscriptionLifecycleService, referrals: ReferralService, legal: LegalConsentService, txEmail: TransactionalEmailService, ledgerAccounts: LedgerAccountService, logger: LoggerService);
    create(userId: string, dto: CreateFarmDto): Promise<Farm>;
    listMine(userId: string): Promise<{
        role: string;
        name: string;
        id: string;
        slug: string;
        status: import("@prisma/client").$Enums.FarmStatus;
    }[]>;
    softDelete(farmId: string, userId: string): Promise<{
        success: true;
    }>;
    private uniqueSlug;
}
