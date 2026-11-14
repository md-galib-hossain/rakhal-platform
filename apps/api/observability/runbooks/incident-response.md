# Incident Response Runbook

## Scope
Use this runbook for alerts from `observability/prometheus/alerts.yml` and Sentry production error spikes.

## Triage Checklist (First 10 Minutes)
1. Confirm alert validity in Grafana and current traffic context.
2. Check `/health`, `/ready`, `/live` results and dependency statuses.
3. Inspect recent deploys/config changes.
4. Check Sentry issue volume and newest fingerprints.
5. Correlate by `requestId`, `userId`, `farmId` in logs for impacted paths.

## Alert-specific Actions

### High 5xx Error Rate
1. Identify top failing routes and status codes.
2. Check DB and Redis saturation/connection errors.
3. Roll back latest deploy if regression confirmed.

### High p95 Latency
1. Identify slowest route(s).
2. Check DB/Redis latency and queue backlog.
3. Apply temporary throttling/rate-limits if overload.

### Auth Failure Spike
1. Validate whether event is abuse or client regression.
2. Review source IP patterns and user-agent anomalies.
3. Tighten throttling and block abusive traffic if needed.

### Health Degradation
1. Validate DB connectivity (`SELECT 1`) and Redis ping.
2. Restart unhealthy pods/instances if infra issue.
3. Escalate to infrastructure owner if persistent.

### Traffic Anomaly
1. Verify expected campaign/load-test windows.
2. If unexpected, activate WAF/rate-limit protections.
3. Monitor error/latency coupled impact for paging.

## Escalation
- Backend On-call: primary responder.
- Security On-call: auth anomaly and abuse incidents.
- Infra/SRE On-call: DB/Redis/platform outages.

## Resolution & Postmortem
1. Record incident timeline and root cause.
2. Add missing metrics/log fields/alerts discovered during incident.
3. Create follow-up tasks with owners and due dates.
