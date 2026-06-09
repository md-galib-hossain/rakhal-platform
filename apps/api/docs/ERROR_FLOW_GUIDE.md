# Rakhal Error Flow Guide

## 1. Purpose
This file explains exactly how errors travel through Rakhal now, in both development and production.

## 2. Error Pipeline (Current)

1. Request enters middleware and gets `requestId` + `traceId`.
2. Controller/service throws an exception (or returns normal response).
3. `GlobalExceptionFilter` catches all uncaught exceptions.
4. Filter classifies error type and maps to status + code + safe message.
5. For 5xx:
- Send exception to Sentry first (`captureException`).
- Write structured error log via Pino logger.
6. For 4xx:
- Write structured warning log via Pino logger.
- Do not send to Sentry (current design).
7. Return safe client error JSON with `requestId` and timestamp.

## 3. Which Error Goes Where

## 4xx Client Errors
Examples: validation errors, unauthorized, forbidden, not found.
- Logger: yes (`warn`)
- Sentry: no (by default)
- Client response: safe, mapped message/code

## 5xx Server Errors
Examples: unhandled runtime errors, infra failures, unexpected exceptions.
- Logger: yes (`error`)
- Sentry: yes (`captureException`)
- Client response: safe generic message in production

## 4. Development vs Production Behavior

## Development (`NODE_ENV=development`)
- Client may receive more specific messages for easier debugging (except where custom handlers restrict).
- Logs are usually pretty-printed (if `LOG_FORMAT=pretty`).
- Sentry typically disabled (`SENTRY_ENABLED=false`) unless explicitly enabled.
- Stack/details can appear in internal logs.

## Production (`NODE_ENV=production`)
- Client never gets stack traces.
- 5xx message is sanitized to generic safe text.
- Logs remain structured JSON for pipelines.
- Sentry should be enabled and receives enriched exception context.

## 5. Current Ordering: Sentry vs Logger
For 5xx in `GlobalExceptionFilter`:
1. `sentry.captureException(...)`
2. `logger.error(...)`
3. `response.status(...).json(...)`

Meaning:
- Sentry acts as error intelligence/event aggregation.
- Logger remains source of operational ground-truth and correlation by requestId.

## 6. Error Response Contract (Client)
```json
{
  "success": false,
  "message": "An unexpected error occurred",
  "code": "INTERNAL_ERROR",
  "requestId": "d5b7...",
  "timestamp": "2026-05-23T10:15:00.000Z"
}
```

## 7. Example Error Journeys

## Example A: Validation failure (400)
1. DTO validation fails.
2. Filter maps to `VALIDATION_ERROR`.
3. Logger writes `warn` with request context.
4. Client gets 400 safe payload.
5. No Sentry event.

## Example B: DB outage (500)
1. Repository/service throws runtime DB error.
2. Filter maps to `INTERNAL_ERROR`.
3. Sentry captures event + route/method/requestId/user context.
4. Logger writes `error` with structured metadata.
5. Client gets generic 500 payload.

## 8. How to Debug a Production Incident
1. Start from alert/Sentry issue.
2. Copy `requestId` from Sentry extra/context.
3. Search logs by `requestId` in Loki/ELK.
4. Correlate with route/method/user/farm context.
5. Check metrics for same window (`5xx`, latency, auth failures).
6. Apply runbook: `observability/runbooks/incident-response.md`.

## 9. Agent Handoff Notes
When another agent continues work, they should:
1. Preserve client-safe error contract.
2. Keep 5xx => both Sentry + logger.
3. Avoid logging sensitive fields (respect redaction rules).
4. Preserve `requestId` propagation end-to-end.
5. Update this file if error routing policy changes.
