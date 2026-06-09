# Observability & Production Hardening Tracker (Rakhal)

## Phase Status
- [x] Phase 1 (Critical) - Done
- [x] Phase 2 - Done
- [x] Phase 3 (Foundation) - Done
- [x] Phase 4 (Code + Ops Spec) - Done

## Phase 1 (Critical) - Done
- [x] Structured logging hardening with `service`, `requestId`, `userId`, `farmId` context enrichment.
- [x] Sensitive-field redaction expansion (password, tokens, auth headers, cookies, OTP, NID/identity fields).
- [x] Global error response standardized to:
  - `{ success, message, code, requestId, timestamp }`
- [x] Safe server-error shaping (no client stack leakage in production).
- [x] Sentry integration added as error-intelligence layer.

## Phase 2 - Done
- [x] HTTP logging pipeline tuned on existing `pino-http` setup.
- [x] Health endpoints implemented (`/health`, `/ready`, `/live`).

## Phase 3 (Metrics Foundation) - Done
- [x] Prometheus-compatible metrics module created.
- [x] `/metrics` endpoint exposed.
- [x] HTTP and auth-failure metrics instrumentation added.

## Phase 4 (Alerting + Dashboards + SLOs) - Done
- [x] Prometheus alert rules authored:
  - [x] 5xx spike
  - [x] high endpoint latency
  - [x] auth failure spikes
  - [x] health degradation
  - [x] unusual traffic anomaly
- [x] Grafana dashboard JSON starter authored (golden signals).
- [x] SLO targets and initial thresholds defined.
- [x] Incident runbook + escalation flow authored.

## New Artifacts
- `observability/prometheus/alerts.yml`
- `observability/grafana/dashboards/rakhal-golden-signals.json`
- `observability/SLO.md`
- `observability/runbooks/incident-response.md`

## Remaining External Enablement (Non-code)
- [ ] Provision Prometheus rule loading from `observability/prometheus/alerts.yml`.
- [ ] Import Grafana dashboard JSON into target Grafana workspace.
- [ ] Wire alert routing (PagerDuty/Slack/Email) in Alertmanager.
- [ ] Calibrate thresholds after 1-2 weeks of production baseline.
