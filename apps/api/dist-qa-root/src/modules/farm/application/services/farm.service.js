"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var FarmService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FarmService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const permission_catalogue_1 = require("src/modules/permission/domain/permission-catalogue");
const trial_abuse_service_1 = require("src/modules/support/application/services/trial-abuse.service");
const subscription_lifecycle_service_1 = require("src/modules/subscription/application/services/subscription-lifecycle.service");
const referral_service_1 = require("src/modules/billing/application/services/referral.service");
const legal_consent_service_1 = require("src/modules/compliance/application/services/legal-consent.service");
const transactional_email_service_1 = require("src/modules/email/application/services/transactional-email.service");
const email_template_enum_1 = require("src/modules/email/domain/enums/email-template.enum");
const ledger_account_service_1 = require("src/modules/finance-v2/ledger/application/ledger-account.service");
const farm_code_1 = require("../../domain/farm-code");
const default_breeds_1 = require("../../domain/default-breeds");
let FarmService = FarmService_1 = class FarmService {
    prisma;
    trialAbuse;
    subscriptionLifecycle;
    referrals;
    legal;
    txEmail;
    ledgerAccounts;
    log;
    constructor(prisma, trialAbuse, subscriptionLifecycle, referrals, legal, txEmail, ledgerAccounts, logger) {
        this.prisma = prisma;
        this.trialAbuse = trialAbuse;
        this.subscriptionLifecycle = subscriptionLifecycle;
        this.referrals = referrals;
        this.legal = legal;
        this.txEmail = txEmail;
        this.ledgerAccounts = ledgerAccounts;
        this.log = logger.setContext(FarmService_1.name);
    }
    async create(userId, dto) {
        await this.legal.assertConsent(userId);
        const ownerRole = await this.prisma.role.findFirst({
            where: { name: permission_catalogue_1.SYSTEM_ROLES.OWNER, farmId: null, isSystemRole: true },
            select: { id: true },
        });
        if (!ownerRole) {
            this.log.error('Owner system role missing — run the RBAC seed', undefined);
            throw new common_1.InternalServerErrorException('System roles are not configured');
        }
        const slug = await this.uniqueSlug(dto.name);
        const year = new Date().getFullYear();
        const prefix = dto.cattleIdPrefix?.toUpperCase() || (0, farm_code_1.deriveFarmPrefix)(dto.name);
        const farm = await this.prisma.$transaction(async (tx) => {
            const counter = await tx.farmCounter.upsert({
                where: { scope: `farm:${year}` },
                create: { scope: `farm:${year}`, value: 1 },
                update: { value: { increment: 1 } },
            });
            const farmCode = (0, farm_code_1.formatFarmCode)(prefix, year, counter.value);
            const createdFarm = await tx.farm.create({
                data: {
                    name: dto.name,
                    slug,
                    description: dto.description,
                    division: dto.division,
                    district: dto.district,
                    upazila: dto.upazila,
                    operationalPurpose: dto.operationalPurpose,
                    herdSizeBand: dto.herdSizeBand,
                    cattleIdPrefix: prefix,
                    farmCode,
                    ownerId: userId,
                    members: {
                        create: { userId, roleId: ownerRole.id },
                    },
                },
            });
            await this.ledgerAccounts.seedDefaultChart(createdFarm.id, tx);
            return createdFarm;
        });
        this.log.info('Farm created', { farmId: farm.id, ownerId: userId });
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { email: true, name: true, preferredLanguage: true },
            });
            if (user) {
                await this.txEmail.sendOnce({
                    idempotencyKey: `welcome:${userId}`,
                    to: user.email,
                    subject: 'Welcome to Rakhal',
                    template: email_template_enum_1.EmailTemplate.WELCOME_EMAIL,
                    templateData: { name: user.name },
                    tenantId: userId,
                    farmId: farm.id,
                    userId,
                    locale: user.preferredLanguage.toLowerCase(),
                });
            }
        }
        catch (err) {
            this.log.error('Welcome email failed (farm still created)', err);
        }
        try {
            await this.trialAbuse.grantTrialIfEligible(farm.id, userId);
        }
        catch (err) {
            this.log.error('Trial provisioning failed (farm still created)', err);
        }
        try {
            await this.subscriptionLifecycle.ensureUsableSubscription(farm.id);
        }
        catch (err) {
            this.log.error('Free-plan fallback failed (farm still created)', err);
        }
        if (dto.referralCode) {
            try {
                await this.referrals.bindReferral(farm.id, userId, dto.referralCode);
            }
            catch (err) {
                this.log.error('Referral attribution failed (farm still created)', err);
            }
        }
        try {
            await this.prisma.breed.createMany({
                data: default_breeds_1.DEFAULT_BREEDS.map((b) => ({
                    farmId: farm.id,
                    name: b.name,
                    description: b.description,
                })),
            });
        }
        catch (err) {
            this.log.error('Default breed seeding failed (farm still created)', err);
        }
        return farm;
    }
    async listMine(userId) {
        const memberships = await this.prisma.farmMember.findMany({
            where: { userId, farm: { deletedAt: null } },
            select: {
                role: { select: { name: true } },
                farm: {
                    select: { id: true, name: true, slug: true, status: true },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
        return memberships.map((m) => ({ ...m.farm, role: m.role.name }));
    }
    async softDelete(farmId, userId) {
        const farm = await this.prisma.farm.findFirst({
            where: { id: farmId, deletedAt: null },
            select: { id: true, ownerId: true },
        });
        if (!farm) {
            throw new common_1.NotFoundException('Farm not found');
        }
        if (farm.ownerId !== userId) {
            throw new common_1.ForbiddenException('Only the farm owner can delete this farm');
        }
        await this.prisma.farm.update({
            where: { id: farmId },
            data: { deletedAt: new Date(), status: client_1.FarmStatus.ARCHIVED },
        });
        this.log.info('Farm soft-deleted', { farmId, ownerId: userId });
        return { success: true };
    }
    async uniqueSlug(name) {
        const base = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '')
            .slice(0, 40) || 'farm';
        for (let attempt = 0; attempt < 50; attempt++) {
            const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
            const taken = await this.prisma.farm.findUnique({
                where: { slug: candidate },
                select: { id: true },
            });
            if (!taken)
                return candidate;
        }
        throw new common_1.ConflictException('Could not generate a unique farm slug');
    }
};
exports.FarmService = FarmService;
exports.FarmService = FarmService = FarmService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        trial_abuse_service_1.TrialAbuseService,
        subscription_lifecycle_service_1.SubscriptionLifecycleService,
        referral_service_1.ReferralService,
        legal_consent_service_1.LegalConsentService,
        transactional_email_service_1.TransactionalEmailService,
        ledger_account_service_1.LedgerAccountService,
        logger_service_1.LoggerService])
], FarmService);
//# sourceMappingURL=farm.service.js.map