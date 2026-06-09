# Rakhal SLOs (Initial)

## Service Scope
- Service: `rakhal-api`
- Critical surfaces: auth, permission-gated farm operations, subscription-gated endpoints.

## SLO-1: Availability
- Objective: >= 99.9% successful API responses (non-5xx) over rolling 30 days.
- Indicator: `1 - (5xx requests / total requests)`
- PromQL:
  - `1 - (sum(rate(http_requests_total{status=~"5.."}[5m])) / clamp_min(sum(rate(http_requests_total[5m])),1))`

## SLO-2: Latency
- Objective: p95 latency < 800ms for critical routes over rolling 30 days.
- Indicator: route-level p95 from histogram.
- PromQL:
  - `histogram_quantile(0.95, sum(rate(http_request_duration_ms_bucket[5m])) by (le, route))`

## SLO-3: Auth Reliability
- Objective: auth failure rate remains below 2% of auth traffic for rolling 7 days (excluding invalid-user/password expected failures from abuse).
- Indicator: `auth_failures_total` trend with security context.

## Error Budget Policy
- Burn-rate based paging:
  - Fast burn: page if budget burn > 14x for 5m.
  - Slow burn: ticket if burn > 2x for 1h.
- Release gating:
  - Pause rollout if p95 latency alert and 5xx alert fire together within 15 minutes.
