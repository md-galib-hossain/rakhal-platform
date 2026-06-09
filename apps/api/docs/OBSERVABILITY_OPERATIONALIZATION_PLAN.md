# Rakhal Observability Operationalization Plan

## Purpose
This plan operationalizes the already-implemented application observability into a fully working runtime stack (Prometheus, Grafana, Alertmanager, Loki/Promtail, Sentry) for local and production environments.

## Status Legend
- [x] Done
- [~] In Progress
- [ ] To Do

## Stage 0 - Application Instrumentation Baseline
Status: [x] Done

## Stage 1 - Local Observability Stack Bring-up
Status: [x] Done

Deliverables:
- [x] `observability/docker-compose.yml`
- [x] `observability/prometheus/prometheus.yml`
- [x] `observability/alertmanager/alertmanager.yml`
- [x] `observability/loki/config.yml`
- [x] `observability/promtail/config.yml`
- [x] Grafana provisioning files (`datasources`, `dashboards`).

## Stage 2 - Prometheus Scraping + Rules Activation
Status: [x] Done

Deliverables:
- [x] `rule_files` wired in Prometheus config.
- [x] `rakhal-api` scrape target configured (`host.docker.internal:5000`).

## Stage 3 - Grafana Datasource + Dashboard Wiring
Status: [x] Done

Deliverables:
- [x] Provisioned Prometheus datasource.
- [x] Provisioned Loki datasource.
- [x] Dashboard provider configured.
- [x] Golden-signals dashboard available in dashboards path.

## Stage 4 - Alertmanager Routing (Slack/PagerDuty/Email)
Status: [x] Done

Deliverables:
- [x] Severity-based routing tree configured.
- [x] Slack receiver configured.
- [x] PagerDuty receiver configured.
- [x] Email receiver template configured.
- [x] Inhibition rule configured.

## Stage 5 - Log Pipeline (Pino -> Promtail -> Loki -> Grafana)
Status: [x] Done

Deliverables:
- [x] Promtail scrape config for app log file.
- [x] Loki push client configuration.
- [x] Grafana Loki datasource provisioning.

## Stage 6 - Sentry Production Operational Setup
Status: [x] Done

Deliverables:
- [x] Production setup guide created.
- [x] Env/release alignment documented.
- [x] Validation checklist documented.

Reference:
- `observability/SENTRY_PROD_SETUP.md`

## Stage 7 - Production Deployment Wiring
Status: [ ] To Do

## Stage 8 - Incident Drills + Threshold Calibration
Status: [ ] To Do

## Stage 9 - Future Maturity (Tracing)
Status: [ ] To Do

## Artifacts Added for Stages 1-6
- `observability/docker-compose.yml`
- `observability/prometheus/prometheus.yml`
- `observability/alertmanager/alertmanager.yml`
- `observability/loki/config.yml`
- `observability/promtail/config.yml`
- `observability/grafana/provisioning/datasources/datasources.yml`
- `observability/grafana/provisioning/dashboards/dashboards.yml`
- `observability/LOCAL_RUNBOOK.md`
- `observability/SENTRY_PROD_SETUP.md`

## Progress Log
- 2026-05-24: Stages 1-6 implemented at configuration/documentation level.
