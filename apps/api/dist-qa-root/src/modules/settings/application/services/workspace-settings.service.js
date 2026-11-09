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
var WorkspaceSettingsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceSettingsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const activity_log_service_1 = require("src/modules/activity/application/services/activity-log.service");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const payment_terms_1 = require("../../domain/payment-terms");
let WorkspaceSettingsService = WorkspaceSettingsService_1 = class WorkspaceSettingsService {
    prisma;
    activityLog;
    log;
    constructor(prisma, logger, activityLog) {
        this.prisma = prisma;
        this.activityLog = activityLog;
        this.log = logger.setContext(WorkspaceSettingsService_1.name);
    }
    async recordSupplierActivity(farmId, userId, eventTitle, actionDetails) {
        try {
            await this.activityLog.record({
                farmId,
                module: client_1.ActivityLogModule.FINANCE,
                eventTitle,
                actionDetails,
                actorId: userId,
            });
        }
        catch (error) {
            this.log.error('Supplier activity log failed', {
                farmId,
                eventTitle,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async getModules(farmId) {
        const settings = await this.ensureModuleSettings(farmId);
        return this.mapModules(settings);
    }
    async updateModules(farmId, dto) {
        await this.ensureModuleSettings(farmId);
        const data = {};
        if (dto.cattle) {
            this.assign(data, 'cattleIdFormat', dto.cattle.id_format);
            this.assign(data, 'cattleTagPrefix', dto.cattle.tag_prefix);
            this.assign(data, 'cattleAvgMilkTargetRange', dto.cattle.avg_daily_milk_target_range);
        }
        if (dto.milk) {
            this.assign(data, 'milkMorningStart', dto.milk.morning_start);
            this.assign(data, 'milkMorningEnd', dto.milk.morning_end);
            this.assign(data, 'milkNoonStart', dto.milk.noon_start);
            this.assign(data, 'milkNoonEnd', dto.milk.noon_end);
            this.assign(data, 'milkEveningStart', dto.milk.evening_start);
            this.assign(data, 'milkEveningEnd', dto.milk.evening_end);
            this.assign(data, 'milkNightStart', dto.milk.night_start);
            this.assign(data, 'milkNightEnd', dto.milk.night_end);
            this.assign(data, 'milkUnit', dto.milk.milk_unit);
            this.assign(data, 'milkAnomalyThresholdPct', dto.milk.anomaly_threshold_pct);
            this.assign(data, 'milkColostrumWindowDays', dto.milk.colostrum_window_days);
        }
        if (dto.reproduction) {
            this.assign(data, 'reproVwpDays', dto.reproduction.vwp_days);
            this.assign(data, 'reproPregnancyCheckDays', dto.reproduction.pregnancy_check_days);
            this.assign(data, 'reproTargetCalvingIntervalDays', dto.reproduction.target_calving_interval_days);
            this.assign(data, 'reproDryPeriodTargetDays', dto.reproduction.dry_period_target_days);
        }
        if (dto.finance) {
            this.assign(data, 'financeCurrency', dto.finance.currency);
            this.assign(data, 'financeCurrencySymbol', dto.finance.currency_symbol);
            this.assign(data, 'financeRunwayWarningDays', dto.finance.survival_runway_warning_days);
            this.assign(data, 'financeRunwayCriticalDays', dto.finance.survival_runway_critical_days);
            this.assign(data, 'financeYearStartMonth', dto.finance.financial_year_start_month);
        }
        if (dto.health) {
            this.assign(data, 'healthScoreWarningPct', dto.health.herd_health_score_warning_pct);
            this.assign(data, 'healthSccAlertThreshold', dto.health.scc_alert_threshold);
            this.assign(data, 'healthMorbidityOutbreakPct', dto.health.morbidity_outbreak_threshold_pct);
        }
        const updated = await this.prisma.farmModuleSettings.update({
            where: { farmId },
            data,
        });
        this.log.info('Module settings updated', { farmId });
        return this.mapModules(updated);
    }
    async updateMilkSessions(farmId, dto) {
        await this.ensureModuleSettings(farmId);
        const sessions = new Set(dto.active_sessions.map((s) => s.toLowerCase()));
        if (sessions.size === 0) {
            throw new common_1.BadRequestException('At least one milk session must stay active');
        }
        const updated = await this.prisma.farmModuleSettings.update({
            where: { farmId },
            data: { milkActiveSessions: [...sessions] },
        });
        this.log.info('Milk sessions updated', {
            farmId,
            activeSessions: [...sessions],
        });
        return this.mapModules(updated).milk;
    }
    async listSuppliers(farmId) {
        const suppliers = await this.prisma.supplier.findMany({
            where: { farmId, deletedAt: null },
            orderBy: { name: 'asc' },
        });
        return { suppliers: suppliers.map((s) => this.mapSupplier(s)) };
    }
    async createSupplier(farmId, dto, userId) {
        try {
            const supplier = await this.prisma.supplier.create({
                data: {
                    farmId,
                    name: dto.name,
                    contact: dto.contact,
                    phone: dto.phone,
                    category: dto.category,
                    paymentTerms: dto.payment_terms,
                    paymentTermsDays: (0, payment_terms_1.parsePaymentTermsDays)(dto.payment_terms),
                    notes: dto.notes,
                },
            });
            this.log.info('Supplier created', { supplierId: supplier.id, farmId });
            await this.recordSupplierActivity(farmId, userId, 'Supplier Added', `Supplier "${supplier.name}" added.`);
            return this.mapSupplier(supplier);
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                e.code === 'P2002') {
                throw new common_1.ConflictException('A supplier with that name already exists');
            }
            throw e;
        }
    }
    async updateSupplier(farmId, id, dto, userId) {
        await this.getSupplierOrThrow(farmId, id);
        const supplier = await this.prisma.supplier.update({
            where: { id },
            data: {
                ...(dto.name !== undefined ? { name: dto.name } : {}),
                ...(dto.contact !== undefined ? { contact: dto.contact } : {}),
                ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
                ...(dto.category !== undefined ? { category: dto.category } : {}),
                ...(dto.payment_terms !== undefined
                    ? {
                        paymentTerms: dto.payment_terms,
                        paymentTermsDays: (0, payment_terms_1.parsePaymentTermsDays)(dto.payment_terms),
                    }
                    : {}),
                ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
                ...(dto.deleted_at !== undefined
                    ? { deletedAt: dto.deleted_at === null ? null : new Date() }
                    : {}),
            },
        });
        const archived = dto.deleted_at !== undefined && dto.deleted_at !== null;
        const restored = dto.deleted_at === null;
        await this.recordSupplierActivity(farmId, userId, archived
            ? 'Supplier Archived'
            : restored
                ? 'Supplier Restored'
                : 'Supplier Updated', `Supplier "${supplier.name}" ${archived ? 'archived' : restored ? 'restored' : 'updated'}.`);
        return this.mapSupplier(supplier);
    }
    async deleteSupplier(farmId, id, userId) {
        const existing = await this.getSupplierOrThrow(farmId, id);
        await this.prisma.supplier.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
        this.log.info('Supplier deactivated', { supplierId: id, farmId });
        await this.recordSupplierActivity(farmId, userId, 'Supplier Archived', `Supplier "${existing.name}" archived.`);
        return { id, deleted_at: new Date() };
    }
    async listServiceProviders(farmId) {
        const providers = await this.prisma.serviceProvider.findMany({
            where: { farmId, deletedAt: null },
            orderBy: { name: 'asc' },
        });
        return {
            service_providers: providers.map((p) => this.mapServiceProvider(p)),
        };
    }
    async createServiceProvider(farmId, dto) {
        try {
            const provider = await this.prisma.serviceProvider.create({
                data: {
                    farmId,
                    name: dto.name,
                    phone: dto.phone,
                    type: dto.type,
                },
            });
            this.log.info('Service provider created', {
                serviceProviderId: provider.id,
                farmId,
            });
            return this.mapServiceProvider(provider);
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                e.code === 'P2002') {
                throw new common_1.ConflictException('A service provider with that name already exists');
            }
            throw e;
        }
    }
    async updateServiceProvider(farmId, id, dto) {
        await this.getServiceProviderOrThrow(farmId, id);
        const provider = await this.prisma.serviceProvider.update({
            where: { id },
            data: {
                ...(dto.name !== undefined ? { name: dto.name } : {}),
                ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
                ...(dto.type !== undefined ? { type: dto.type } : {}),
                ...(dto.deleted_at !== undefined
                    ? { deletedAt: dto.deleted_at === null ? null : new Date() }
                    : {}),
            },
        });
        return this.mapServiceProvider(provider);
    }
    async deleteServiceProvider(farmId, id) {
        await this.getServiceProviderOrThrow(farmId, id);
        await this.prisma.serviceProvider.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
        this.log.info('Service provider deactivated', {
            serviceProviderId: id,
            farmId,
        });
        return { id, deleted_at: new Date() };
    }
    async getBilling(farmId) {
        const subscription = await this.prisma.farmSubscription.findFirst({
            where: { farmId },
            include: { subscriptionPlan: true },
            orderBy: { createdAt: 'desc' },
        });
        return {
            current_plan: subscription
                ? {
                    name: subscription.subscriptionPlan.name,
                    price_per_month: Number(subscription.subscriptionPlan.monthlyPrice),
                    currency: 'Tk',
                    status: subscription.status.toLowerCase(),
                    next_billing_date: subscription.expiresAt,
                }
                : null,
            payment_method: null,
            invoices: [],
        };
    }
    async ensureModuleSettings(farmId) {
        const existing = await this.prisma.farmModuleSettings.findUnique({
            where: { farmId },
        });
        if (existing)
            return existing;
        return this.prisma.farmModuleSettings.create({ data: { farmId } });
    }
    async getSupplierOrThrow(farmId, id) {
        const supplier = await this.prisma.supplier.findFirst({
            where: { id, farmId },
        });
        if (!supplier)
            throw new common_1.NotFoundException('Supplier not found');
        return supplier;
    }
    async getServiceProviderOrThrow(farmId, id) {
        const provider = await this.prisma.serviceProvider.findFirst({
            where: { id, farmId },
        });
        if (!provider)
            throw new common_1.NotFoundException('Service provider not found');
        return provider;
    }
    assign(data, key, value) {
        if (value !== undefined)
            data[key] = value;
    }
    mapSupplier(s) {
        return {
            id: s.id,
            name: s.name,
            contact: s.contact,
            phone: s.phone,
            category: s.category,
            payment_terms: s.paymentTerms,
            payment_terms_days: s.paymentTermsDays,
            notes: s.notes,
            deleted_at: s.deletedAt,
        };
    }
    mapServiceProvider(p) {
        return {
            id: p.id,
            name: p.name,
            phone: p.phone,
            type: p.type,
            deleted_at: p.deletedAt,
        };
    }
    mapModules(s) {
        return {
            cattle: {
                id_format: s.cattleIdFormat,
                tag_prefix: s.cattleTagPrefix,
                avg_daily_milk_target_range: s.cattleAvgMilkTargetRange,
            },
            milk: {
                active_sessions: s.milkActiveSessions,
                morning_start: s.milkMorningStart,
                morning_end: s.milkMorningEnd,
                noon_start: s.milkNoonStart,
                noon_end: s.milkNoonEnd,
                evening_start: s.milkEveningStart,
                evening_end: s.milkEveningEnd,
                night_start: s.milkNightStart,
                night_end: s.milkNightEnd,
                milk_unit: s.milkUnit,
                anomaly_threshold_pct: s.milkAnomalyThresholdPct,
                colostrum_window_days: s.milkColostrumWindowDays,
            },
            reproduction: {
                vwp_days: s.reproVwpDays,
                pregnancy_check_days: s.reproPregnancyCheckDays,
                target_calving_interval_days: s.reproTargetCalvingIntervalDays,
                dry_period_target_days: s.reproDryPeriodTargetDays,
            },
            finance: {
                currency: s.financeCurrency,
                currency_symbol: s.financeCurrencySymbol,
                survival_runway_warning_days: s.financeRunwayWarningDays,
                survival_runway_critical_days: s.financeRunwayCriticalDays,
                financial_year_start_month: s.financeYearStartMonth,
            },
            health: {
                herd_health_score_warning_pct: s.healthScoreWarningPct,
                scc_alert_threshold: s.healthSccAlertThreshold,
                morbidity_outbreak_threshold_pct: s.healthMorbidityOutbreakPct,
            },
        };
    }
};
exports.WorkspaceSettingsService = WorkspaceSettingsService;
exports.WorkspaceSettingsService = WorkspaceSettingsService = WorkspaceSettingsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService,
        activity_log_service_1.ActivityLogService])
], WorkspaceSettingsService);
//# sourceMappingURL=workspace-settings.service.js.map