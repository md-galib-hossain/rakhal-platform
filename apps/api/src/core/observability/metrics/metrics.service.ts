import { Injectable } from '@nestjs/common';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();

  private readonly httpRequestsTotal: Counter<string>;
  private readonly httpRequestDurationMs: Histogram<string>;
  private readonly httpErrorsTotal: Counter<string>;
  private readonly authFailuresTotal: Counter<string>;
  // Notifications v2 (RAKHAL-493, EPIC_NOTIFICATIONS_V2 §5)
  private readonly notificationOccurrenceTotal: Counter<string>;
  private readonly notificationFireLagSeconds: Histogram<string>;
  private readonly notificationReconcileTotal: Counter<string>;
  private readonly notificationQueueDelayed: Gauge<string>;

  constructor() {
    collectDefaultMetrics({ register: this.registry, prefix: 'rakhal_' });

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.httpRequestDurationMs = new Histogram({
      name: 'http_request_duration_ms',
      help: 'HTTP request duration in milliseconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [5, 10, 25, 50, 100, 200, 400, 800, 1500, 3000],
      registers: [this.registry],
    });

    this.httpErrorsTotal = new Counter({
      name: 'http_errors_total',
      help: 'Total HTTP error responses',
      labelNames: ['route', 'status', 'error_code'],
      registers: [this.registry],
    });

    this.authFailuresTotal = new Counter({
      name: 'auth_failures_total',
      help: 'Authentication and authorization failures',
      labelNames: ['reason', 'route'],
      registers: [this.registry],
    });

    this.notificationOccurrenceTotal = new Counter({
      name: 'notification_occurrence_total',
      help: 'Notification occurrences by outcome (fired|skipped|cancelled) and reason',
      labelNames: ['outcome', 'reason'],
      registers: [this.registry],
    });

    this.notificationFireLagSeconds = new Histogram({
      name: 'notification_fire_lag_seconds',
      help: 'Seconds between an occurrence fireAt and the moment it fired',
      buckets: [1, 5, 15, 30, 60, 120, 300, 900, 3600, 7200],
      registers: [this.registry],
    });

    this.notificationReconcileTotal = new Counter({
      name: 'notification_reconcile_total',
      help: 'Notification reconcile actions (enqueued|removed|advanced|purged)',
      labelNames: ['action'],
      registers: [this.registry],
    });

    this.notificationQueueDelayed = new Gauge({
      name: 'notification_queue_delayed',
      help: 'Delayed/waiting jobs in the notification-occurrence queue (set on reconcile)',
      registers: [this.registry],
    });
  }

  recordNotificationOccurrence(
    outcome: 'fired' | 'skipped' | 'cancelled',
    reason = 'NONE',
  ): void {
    this.notificationOccurrenceTotal.inc({ outcome, reason });
  }

  observeNotificationFireLag(seconds: number): void {
    this.notificationFireLagSeconds.observe(Math.max(0, seconds));
  }

  recordNotificationReconcile(
    action: 'enqueued' | 'removed' | 'advanced' | 'purged',
    count = 1,
  ): void {
    if (count > 0) this.notificationReconcileTotal.inc({ action }, count);
  }

  setNotificationQueueDelayed(count: number): void {
    this.notificationQueueDelayed.set(count);
  }

  recordHttpRequest(
    labels: { method: string; route: string; status: string },
    durationMs: number,
  ): void {
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationMs.observe(labels, durationMs);
  }

  recordHttpError(route: string, status: number, errorCode: string): void {
    this.httpErrorsTotal.inc({
      route,
      status: String(status),
      error_code: errorCode,
    });
  }

  recordAuthFailure(reason: string, route: string): void {
    this.authFailuresTotal.inc({ reason, route });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}
