"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const throttler_1 = require("@nestjs/throttler");
const schedule_1 = require("@nestjs/schedule");
const auth_module_1 = require("./modules/auth/auth.module");
const audit_module_1 = require("./modules/audit/audit.module");
const permission_module_1 = require("./modules/permission/permission.module");
const subscription_module_1 = require("./modules/subscription/subscription.module");
const tenant_access_module_1 = require("./modules/tenant-access/tenant-access.module");
const user_module_1 = require("./modules/user/user.module");
const prisma_module_1 = require("./core/database/prisma/prisma.module");
const config_1 = require("@nestjs/config");
const env_1 = require("src/core/config/env");
const domain_events_module_1 = require("src/common/events/domain-events.module");
const outbox_module_1 = require("src/common/outbox/outbox.module");
const farm_time_module_1 = require("src/common/farm-time/farm-time.module");
const business_reporting_module_1 = require("src/modules/business-reporting/business-reporting.module");
const finance_v2_ledger_module_1 = require("src/modules/finance-v2/ledger/finance-v2-ledger.module");
const finance_v2_accounts_module_1 = require("src/modules/finance-v2/accounts/finance-v2-accounts.module");
const finance_v2_payments_module_1 = require("src/modules/finance-v2/payments/finance-v2-payments.module");
const finance_v2_transfers_module_1 = require("src/modules/finance-v2/transfers/finance-v2-transfers.module");
const finance_v2_receivables_module_1 = require("src/modules/finance-v2/receivables/finance-v2-receivables.module");
const finance_v2_income_module_1 = require("src/modules/finance-v2/income/finance-v2-income.module");
const sales_module_1 = require("src/modules/sales/sales.module");
const sell_animal_module_1 = require("src/modules/sales/application/use-cases/sell-animal/sell-animal.module");
const sell_manure_module_1 = require("src/modules/sales/application/use-cases/sell-manure/sell-manure.module");
const purchasing_module_1 = require("src/modules/purchasing/purchasing.module");
const i18n_module_1 = require("src/common/i18n/i18n.module");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const redis_module_1 = require("src/core/redis/redis.module");
const throttler_storage_module_1 = require("src/core/throttler/throttler-storage.module");
const redis_throttler_storage_1 = require("src/core/throttler/redis-throttler.storage");
const rakhal_throttler_guard_1 = require("src/core/throttler/rakhal-throttler.guard");
const cache_module_1 = require("src/core/cache/cache.module");
const request_context_middleware_1 = require("src/common/middleware/request-context.middleware");
const logger_middleware_1 = require("src/core/logger/logger/logger.middleware");
const core_1 = require("@nestjs/core");
const global_exception_filter_1 = require("src/common/filters/global-exception.filter");
const response_envelope_interceptor_1 = require("src/common/interceptors/response-envelope.interceptor");
const email_module_1 = require("./modules/email/email.module");
const sentry_module_1 = require("./core/observability/sentry/sentry.module");
const health_controller_1 = require("src/common/presentation/controllers/health.controller");
const metrics_module_1 = require("./core/observability/metrics/metrics.module");
const cattle_module_1 = require("./modules/cattle/cattle.module");
const reproduction_module_1 = require("./modules/reproduction/reproduction.module");
const health_module_1 = require("./modules/health/health.module");
const calf_module_1 = require("./modules/calf/calf.module");
const milk_module_1 = require("./modules/milk/milk.module");
const buyer_module_1 = require("./modules/buyer/buyer.module");
const finance_module_1 = require("./modules/finance/finance.module");
const dashboard_module_1 = require("./modules/dashboard/dashboard.module");
const feed_module_1 = require("./modules/feed/feed.module");
const reports_module_1 = require("./modules/reports/reports.module");
const inventory_module_1 = require("./modules/inventory/inventory.module");
const animal_events_module_1 = require("./modules/animal-events/animal-events.module");
const farm_module_1 = require("./modules/farm/farm.module");
const activity_module_1 = require("./modules/activity/activity.module");
const task_module_1 = require("./modules/task/task.module");
const settings_module_1 = require("./modules/settings/settings.module");
const onboarding_module_1 = require("./modules/onboarding/onboarding.module");
const scoreboard_module_1 = require("./modules/scoreboard/scoreboard.module");
const notification_module_1 = require("./modules/notification/notification.module");
const scheduler_module_1 = require("./modules/scheduler/scheduler.module");
const billing_module_1 = require("./modules/billing/billing.module");
const admin_module_1 = require("./modules/admin/admin.module");
const otp_module_1 = require("./modules/otp/otp.module");
const compliance_module_1 = require("./modules/compliance/compliance.module");
const media_module_1 = require("./modules/media/media.module");
const support_module_1 = require("./modules/support/support.module");
const search_module_1 = require("./modules/search/search.module");
let AppModule = class AppModule {
    configure(consumer) {
        consumer
            .apply(request_context_middleware_1.RequestContextMiddleware, logger_middleware_1.LoggerMiddleware)
            .forRoutes({ path: '*', method: common_1.RequestMethod.ALL });
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: '.env',
                load: [
                    env_1.appConfig,
                    env_1.authConfig,
                    env_1.databaseConfig,
                    env_1.redisConfig,
                    env_1.emailConfig,
                    env_1.sentryConfig,
                    env_1.telegramConfig,
                ],
                expandVariables: true,
                cache: true,
            }),
            jwt_1.JwtModule.registerAsync({
                global: true,
                imports: [config_1.ConfigModule.forFeature(env_1.authConfig)],
                inject: [env_1.authConfig.KEY],
                useFactory: (config) => ({
                    secret: config.accessSecret,
                    signOptions: {
                        expiresIn: config.accessExpiresIn,
                    },
                }),
            }),
            throttler_1.ThrottlerModule.forRootAsync({
                imports: [config_1.ConfigModule.forFeature(env_1.authConfig), throttler_storage_module_1.ThrottlerStorageModule],
                inject: [env_1.authConfig.KEY, redis_throttler_storage_1.RedisThrottlerStorage],
                useFactory: (config, storage) => ({
                    storage,
                    throttlers: [
                        {
                            name: 'global',
                            ttl: config.rateLimit.ttlSeconds * 1000,
                            limit: config.rateLimit.globalMaxRequests,
                            generateKey: (_ctx, tracker) => `g:${tracker}`,
                        },
                        {
                            name: 'default',
                            ttl: config.rateLimit.ttlSeconds * 1000,
                            limit: config.rateLimit.maxRequests,
                        },
                    ],
                }),
            }),
            schedule_1.ScheduleModule.forRoot(),
            user_module_1.UsersModule,
            auth_module_1.AuthModule,
            tenant_access_module_1.TenantAccessModule,
            permission_module_1.PermissionModule,
            subscription_module_1.SubscriptionModule,
            audit_module_1.AuditModule,
            prisma_module_1.PrismaModule,
            logger_module_1.LoggerModule,
            redis_module_1.RedisModule,
            cache_module_1.CacheModule,
            domain_events_module_1.DomainEventsModule,
            outbox_module_1.OutboxModule,
            farm_time_module_1.FarmTimeModule,
            business_reporting_module_1.BusinessReportingModule,
            finance_v2_ledger_module_1.FinanceV2LedgerModule,
            finance_v2_accounts_module_1.FinanceV2AccountsModule,
            finance_v2_receivables_module_1.FinanceV2ReceivablesModule,
            finance_v2_payments_module_1.FinanceV2PaymentsModule,
            finance_v2_transfers_module_1.FinanceV2TransfersModule,
            finance_v2_income_module_1.FinanceV2IncomeModule,
            sales_module_1.SalesModule,
            sell_animal_module_1.SellAnimalModule,
            sell_manure_module_1.SellManureModule,
            purchasing_module_1.PurchasingModule,
            i18n_module_1.I18nModule,
            email_module_1.EmailModule,
            sentry_module_1.SentryModule,
            metrics_module_1.MetricsModule,
            cattle_module_1.CattleModule,
            reproduction_module_1.ReproductionModule,
            health_module_1.HealthModule,
            calf_module_1.CalfModule,
            milk_module_1.MilkModule,
            buyer_module_1.BuyerModule,
            finance_module_1.FinanceModule,
            dashboard_module_1.DashboardModule,
            feed_module_1.FeedModule,
            reports_module_1.ReportsModule,
            inventory_module_1.InventoryModule,
            animal_events_module_1.AnimalEventsModule,
            farm_module_1.FarmModule,
            settings_module_1.SettingsModule,
            onboarding_module_1.OnboardingModule,
            scoreboard_module_1.ScoreboardModule,
            notification_module_1.NotificationModule,
            scheduler_module_1.SchedulerModule,
            billing_module_1.BillingModule,
            admin_module_1.AdminModule,
            otp_module_1.OtpModule,
            compliance_module_1.ComplianceModule,
            media_module_1.MediaModule,
            support_module_1.SupportModule,
            search_module_1.SearchModule,
            activity_module_1.ActivityModule,
            task_module_1.TaskModule,
        ],
        controllers: [health_controller_1.HealthController],
        providers: [
            rakhal_throttler_guard_1.RakhalThrottlerGuard,
            {
                provide: core_1.APP_GUARD,
                useExisting: rakhal_throttler_guard_1.RakhalThrottlerGuard,
            },
            {
                provide: core_1.APP_INTERCEPTOR,
                useClass: response_envelope_interceptor_1.ResponseEnvelopeInterceptor,
            },
            {
                provide: core_1.APP_FILTER,
                useClass: global_exception_filter_1.GlobalExceptionFilter,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map