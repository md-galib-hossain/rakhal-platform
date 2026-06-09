# Rakhal Full Observability Guide

## 1. What We Implemented

### Logging (Pino)
- Structured logging is active through `nestjs-pino`.
- Correlation fields are propagated in log context:
  - `requestId`
  - `traceId`
  - `userId` (when available)
  - `farmId` (derived from tenant context)
  - `service` (`rakhal-api`)
- Sensitive data redaction is enabled for auth/PII fields:
  - password, token, accessToken, refreshToken
  - authorization headers
  - cookies / set-cookie
  - otp
  - nid / identityNumber

### Error Handling
- Global exception filter returns a safe unified client format:
```json
{
  "success": false,
  "message": "...",
  "code": "...",
  "requestId": "...",
  "timestamp": "..."
}
```
- 5xx exceptions are logged as errors and captured in Sentry.
- 4xx exceptions are logged as warnings.

### Sentry (Error Intelligence)
- Sentry initialization is wired in bootstrap.
- Global exception filter sends server exceptions to Sentry with context:
  - `requestId`, `traceId`, `route`, `method`, `userId`.

### Health Checks
- Endpoints implemented:
  - `/health`
  - `/ready`
  - `/live`
- Includes DB + Redis dependency status summary.

### Metrics (Prometheus Compatible)
- `/metrics` endpoint is exposed.
- Metrics currently instrumented:
  - `http_requests_total`
  - `http_request_duration_ms`
  - `http_errors_total`
  - `auth_failures_total`
  - default process/runtime metrics (`rakhal_` prefix)

### Alerting & Dashboards (Ops Artifacts)
- Prometheus rules: `observability/prometheus/alerts.yml`
- Grafana dashboard: `observability/grafana/dashboards/rakhal-golden-signals.json`
- SLO doc: `observability/SLO.md`
- Incident runbook: `observability/runbooks/incident-response.md`

## 2. Required Environment Variables

## Core App
- `NODE_ENV` (`development|production|test`)
- `PORT`
- `APP_NAME` (default: `rakhal-api`)
- `APP_VERSION`

## Logging
- `LOG_LEVEL` (`error|warn|info|debug|verbose`)
- `LOG_FORMAT` (`json|pretty`)
- `ENABLE_HTTP_LOGGING`

## Sentry
- `SENTRY_ENABLED` (`true|false`)
- `SENTRY_DSN`
- `SENTRY_ENVIRONMENT`
- `SENTRY_RELEASE` (recommended to match app version or git sha)
- `SENTRY_TRACES_SAMPLE_RATE` (0..1)

## Existing Infra Dependencies
- DB: `DATABASE_URL`
- Redis: `REDIS_HOST`, `REDIS_PORT`, optional TLS/auth vars
- Auth/JWT and existing app envs remain required as before

## Example `.env` (Production)
```env
NODE_ENV=production
PORT=5000
APP_NAME=rakhal-api
APP_VERSION=1.3.0

LOG_LEVEL=info
LOG_FORMAT=json
ENABLE_HTTP_LOGGING=true

SENTRY_ENABLED=true
SENTRY_DSN=https://<key>@o0.ingest.sentry.io/<project>
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=rakhal-api@1.3.0
SENTRY_TRACES_SAMPLE_RATE=0.2
```

## Example `.env` (Development)
```env
NODE_ENV=development
LOG_LEVEL=debug
LOG_FORMAT=pretty
ENABLE_HTTP_LOGGING=true

SENTRY_ENABLED=false
SENTRY_TRACES_SAMPLE_RATE=0
```

## 3. How to Use (Step by Step)

### Step 1: Install dependencies
```bash
npm install
```

### Step 2: Configure env
- Set required app envs.
- For production, enable Sentry and provide DSN.

### Step 3: Run the app
```bash
npm run start:dev
```
or
```bash
npm run start:prod
```

### Step 4: Validate health
```bash
curl http://localhost:5000/health
curl http://localhost:5000/ready
curl http://localhost:5000/live
```

### Step 5: Validate metrics
```bash
curl http://localhost:5000/metrics
```
Expect metric families like:
- `http_requests_total`
- `http_request_duration_ms_bucket`
- `http_errors_total`
- `auth_failures_total`

### Step 6: Load Prometheus alerts
- Put `observability/prometheus/alerts.yml` into Prometheus rules path.
- Reload Prometheus and verify rules in UI.

### Step 7: Import Grafana dashboard
- Import `observability/grafana/dashboards/rakhal-golden-signals.json`.
- Bind to your Prometheus datasource.

### Step 8: Configure alert routing in Alertmanager
- Route `severity=critical` to pager.
- Route `severity=warning` to Slack/email.

### Step 9: Baseline and tune
- Collect 1-2 weeks of real production traffic.
- Tune thresholds in `alerts.yml` based on p95 latency and error ratio baseline.

## 4. Practical Examples

## Example A: Business event log
```ts
this.log.info('Subscription activated', {
  action: 'subscription.activate',
  userId,
  farmId,
  planId,
});
```

## Example B: Recoverable warning
```ts
this.log.warn('Invalid OTP attempt', {
  action: 'auth.otp.validate',
  userId,
  farmId,
  reason: 'otp_mismatch',
});
```

## Example C: Server error (auto captured by filter)
```ts
throw new Error('Database connection lost');
```
This will:
- return safe error response to client,
- log as `error` with request context,
- send exception to Sentry (5xx path).

## 5. File Map (Quick Reference)
- Logger config: `src/core/logger/logger/logger.module.ts`
- Logger service: `src/core/logger/logger/logger.service.ts`
- Redaction paths: `src/core/logger/logger/logger.constants.ts`
- Request context middleware: `src/common/middleware/request-context.middleware.ts`
- Global exception filter: `src/common/filters/global-exception.filter.ts`
- Sentry service/module: `src/core/observability/sentry/`
- Metrics service/module/interceptor: `src/core/observability/metrics/`
- Health + metrics endpoints: `src/common/presentation/controllers/health.controller.ts`
- Ops assets: `observability/`

## 6. Operational Notes
- Metrics labels intentionally avoid high-cardinality values like `requestId`.
- `requestId` is the primary key for deep incident triage across logs and Sentry.
- Keep `SENTRY_RELEASE` aligned with deployment version for release health and regression tracking.
