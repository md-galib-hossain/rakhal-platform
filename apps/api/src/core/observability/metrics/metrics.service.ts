import { Injectable } from '@nestjs/common';
import {
  Counter,
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
