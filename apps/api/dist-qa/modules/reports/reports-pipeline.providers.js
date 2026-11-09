"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REPORT_PIPELINE_PROVIDERS = exports.REPORT_PIPELINE_IMPORTS = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const config_1 = require("@nestjs/config");
const env_1 = require("src/core/config/env");
const logger_module_1 = require("src/core/logger/logger/logger.module");
const farm_settings_module_1 = require("../farm-settings/farm-settings.module");
const media_module_1 = require("../media/media.module");
const report_compute_service_1 = require("./application/pipeline/report-compute.service");
const report_generation_service_1 = require("./application/pipeline/report-generation.service");
const report_lifecycle_service_1 = require("./application/pipeline/report-lifecycle.service");
const report_pipeline_constants_1 = require("./application/pipeline/report-pipeline.constants");
const report_reconcile_service_1 = require("./application/pipeline/report-reconcile.service");
const report_ports_1 = require("./application/ports/report-ports");
const renderer_1 = require("./infrastructure/renderer");
const cron_1 = require("./infrastructure/cron");
const report_queue_service_1 = require("./infrastructure/queue/report-queue.service");
const reports_processor_1 = require("./infrastructure/queue/reports.processor");
exports.REPORT_PIPELINE_IMPORTS = [
    config_1.ConfigModule.forFeature(env_1.redisConfig),
    bullmq_1.BullModule.forRootAsync({
        imports: [config_1.ConfigModule.forFeature(env_1.redisConfig)],
        inject: [env_1.redisConfig.KEY],
        useFactory: (config) => ({
            prefix: process.env.NODE_ENV === 'test' ? 'bull-test' : undefined,
            connection: {
                host: config.host,
                port: config.port,
                username: config.username,
                password: config.password,
                db: config.database,
                tls: config.tlsEnabled ? {} : undefined,
                connectTimeout: config.connectTimeoutMs,
                maxRetriesPerRequest: null,
            },
        }),
    }),
    bullmq_1.BullModule.registerQueue({ name: report_pipeline_constants_1.REPORTS_QUEUE }),
    logger_module_1.LoggerModule,
    farm_settings_module_1.FarmSettingsModule,
    media_module_1.MediaModule,
];
exports.REPORT_PIPELINE_PROVIDERS = [
    report_compute_service_1.ReportComputeService,
    report_lifecycle_service_1.ReportLifecycleService,
    report_generation_service_1.ReportGenerationService,
    report_reconcile_service_1.ReportReconcileService,
    report_queue_service_1.ReportQueueService,
    reports_processor_1.ReportsProcessor,
    { provide: report_ports_1.REPORT_COMPUTE, useExisting: report_compute_service_1.ReportComputeService },
    { provide: report_ports_1.REPORT_QUEUE, useExisting: report_queue_service_1.ReportQueueService },
    { provide: report_reconcile_service_1.REPORT_JOB_ENSURER, useExisting: report_queue_service_1.ReportQueueService },
    ...renderer_1.REPORT_RENDERER_PROVIDERS,
    ...cron_1.REPORT_SCHEDULER_PROVIDERS,
];
//# sourceMappingURL=reports-pipeline.providers.js.map