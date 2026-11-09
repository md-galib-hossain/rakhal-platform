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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsService = void 0;
const common_1 = require("@nestjs/common");
const prom_client_1 = require("prom-client");
let MetricsService = class MetricsService {
    registry = new prom_client_1.Registry();
    httpRequestsTotal;
    httpRequestDurationMs;
    httpErrorsTotal;
    authFailuresTotal;
    notificationOccurrenceTotal;
    notificationFireLagSeconds;
    notificationReconcileTotal;
    notificationQueueDelayed;
    constructor() {
        (0, prom_client_1.collectDefaultMetrics)({ register: this.registry, prefix: 'rakhal_' });
        this.httpRequestsTotal = new prom_client_1.Counter({
            name: 'http_requests_total',
            help: 'Total HTTP requests',
            labelNames: ['method', 'route', 'status'],
            registers: [this.registry],
        });
        this.httpRequestDurationMs = new prom_client_1.Histogram({
            name: 'http_request_duration_ms',
            help: 'HTTP request duration in milliseconds',
            labelNames: ['method', 'route', 'status'],
            buckets: [5, 10, 25, 50, 100, 200, 400, 800, 1500, 3000],
            registers: [this.registry],
        });
        this.httpErrorsTotal = new prom_client_1.Counter({
            name: 'http_errors_total',
            help: 'Total HTTP error responses',
            labelNames: ['route', 'status', 'error_code'],
            registers: [this.registry],
        });
        this.authFailuresTotal = new prom_client_1.Counter({
            name: 'auth_failures_total',
            help: 'Authentication and authorization failures',
            labelNames: ['reason', 'route'],
            registers: [this.registry],
        });
        this.notificationOccurrenceTotal = new prom_client_1.Counter({
            name: 'notification_occurrence_total',
            help: 'Notification occurrences by outcome (fired|skipped|cancelled) and reason',
            labelNames: ['outcome', 'reason'],
            registers: [this.registry],
        });
        this.notificationFireLagSeconds = new prom_client_1.Histogram({
            name: 'notification_fire_lag_seconds',
            help: 'Seconds between an occurrence fireAt and the moment it fired',
            buckets: [1, 5, 15, 30, 60, 120, 300, 900, 3600, 7200],
            registers: [this.registry],
        });
        this.notificationReconcileTotal = new prom_client_1.Counter({
            name: 'notification_reconcile_total',
            help: 'Notification reconcile actions (enqueued|removed|advanced|purged)',
            labelNames: ['action'],
            registers: [this.registry],
        });
        this.notificationQueueDelayed = new prom_client_1.Gauge({
            name: 'notification_queue_delayed',
            help: 'Delayed/waiting jobs in the notification-occurrence queue (set on reconcile)',
            registers: [this.registry],
        });
    }
    recordNotificationOccurrence(outcome, reason = 'NONE') {
        this.notificationOccurrenceTotal.inc({ outcome, reason });
    }
    observeNotificationFireLag(seconds) {
        this.notificationFireLagSeconds.observe(Math.max(0, seconds));
    }
    recordNotificationReconcile(action, count = 1) {
        if (count > 0)
            this.notificationReconcileTotal.inc({ action }, count);
    }
    setNotificationQueueDelayed(count) {
        this.notificationQueueDelayed.set(count);
    }
    recordHttpRequest(labels, durationMs) {
        this.httpRequestsTotal.inc(labels);
        this.httpRequestDurationMs.observe(labels, durationMs);
    }
    recordHttpError(route, status, errorCode) {
        this.httpErrorsTotal.inc({
            route,
            status: String(status),
            error_code: errorCode,
        });
    }
    recordAuthFailure(reason, route) {
        this.authFailuresTotal.inc({ reason, route });
    }
    async getMetrics() {
        return this.registry.metrics();
    }
    getContentType() {
        return this.registry.contentType;
    }
};
exports.MetricsService = MetricsService;
exports.MetricsService = MetricsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], MetricsService);
//# sourceMappingURL=metrics.service.js.map