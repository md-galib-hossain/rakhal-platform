# Reports v2 contracts (RPT-01)

Pure TypeScript. No Nest, Prisma or I/O imports. Spec: `docs/EPIC_REPORTS.md`.

| File | Contract |
|---|---|
| `enums.ts` | ReportType, ReportOrigin, ReportStatus, ReportDomain, ReportScopeKind, DatePreset, ReportErrorCategory (transient: STORAGE_UNAVAILABLE, DB_TIMEOUT, QUEUE_UNAVAILABLE; permanent incl. RENDER_FAILED, GENERATION_FAILED), `isTransientError`, `isTerminalStatus` |
| `period.ts` | `ReportPeriod`: `[start, end)` instants (end exclusive), inclusive farm-local `startDate`/`endDate`, Mon-Sun weeks |
| `scope.ts` | `ReportScope` union; GROUP carries `membershipAsOf` (membership is current-only) |
| `metric-value.ts` | `MetricValue` (4 states), `Comparison`, `MetricResult` (with `source`), `safePercentChange`, `compareMetric` |
| `data-quality.ts` | `DataQuality` coverage, notes, flags |
| `metric-definition.ts` | `MetricId` union (seed only), `MetricDefinition`, `MetricRegistry` type |
| `template.ts` | `ReportTemplateDefinition`, `ReportRequestConfig`, `isSubsetOfAllowed` |
| `snapshot.ts` | `ReportSnapshotPayload` (optional `reportType`), `assertNoFinance` |
| `job-key.ts` | `scheduledReportKey` = unique `(farmId, type, periodStart, templateVersion)` |

## Invariants
1. **Missing is not zero.** Absent data is `missing` / `not_calculated` / `not_applicable`; zero is `{state:'value', value:0}`. Percent change is `null` when the previous value is 0 or not a value.
2. **Pending is not failure.** QUEUED and PROCESSING are pending; only FAILED is failure. Transient errors retry; permanent ones fail at once. COMPLETED is never overwritten.
3. **No finance leak.** Without `finance.read`, `includesFinance` is false and finance sections/metrics/exceptions are absent. `assertNoFinance` enforces it. The ledger feed cost counts as finance (`requiresPermission`).
4. **Immutability.** The snapshot is written once; detail view and PDF render only from it. New template versions affect future reports only.
5. **Labelled figures.** Same-named numbers carry `source` (e.g. `offeredMinusRefusal` vs `recordedActual`; distribution cost vs ledger Feed 5000).
6. **Idempotent schedule.** Same key means same report; a duplicate insert is a skip.

Open: metric id list, finalization wait hours, non-finance permission strings are `TODO(owner)`.
