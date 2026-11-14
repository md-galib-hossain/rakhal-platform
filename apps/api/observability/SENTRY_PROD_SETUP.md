# Sentry Production Setup (Stage 6)

## 1. Create Project
1. Create a new Node.js project in Sentry.
2. Copy DSN.

## 2. Configure Environment
Set on production environment:

```env
SENTRY_ENABLED=true
SENTRY_DSN=https://<key>@o0.ingest.sentry.io/<project>
SENTRY_ENVIRONMENT=production
APP_VERSION=1.3.0
SENTRY_RELEASE=rakhal-api@1.3.0
SENTRY_TRACES_SAMPLE_RATE=0.2
```

## 3. Release Alignment
- Keep Git tag and release aligned:
  - `git tag v1.3.0`
  - `APP_VERSION=1.3.0`
  - `SENTRY_RELEASE=rakhal-api@1.3.0`

## 4. Deployment Validation
1. Deploy app with env vars.
2. Trigger a controlled 5xx test error in non-critical endpoint.
3. Confirm Sentry:
- Issue appears under `Issues`.
- Event contains `requestId`, route, method, user context.
- Release is visible in `Releases`.

## 5. Operations Notes
- Keep `SENTRY_ENABLED=false` for local unless explicitly testing.
- Use lower traces sample rate in production initially (0.1-0.2) and tune based on volume/cost.
