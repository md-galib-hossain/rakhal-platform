import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type {
  MetricDefinition,
  MetricId,
  MetricRegistry,
} from '../../domain/contracts/metric-definition';
import {
  isSubsetOfAllowed,
  type ReportTemplateDefinition,
} from '../../domain/contracts/template';
import type { ReportScope } from '../../domain/contracts/scope';
import { MAX_SELECTED_METRICS, ReportApiReason } from './reports-api.constants';

/** A metric whose value is finance data: gated on `finance.read`. */
export const isFinanceMetric = (def: MetricDefinition): boolean =>
  def.requiresPermission === 'finance.read' || def.domain === 'finance';

/** Distinct metric ids the template offers AND the registry can compute, in template order. */
export function allowedMetricIds(
  template: ReportTemplateDefinition,
  registry: MetricRegistry,
): MetricId[] {
  const seen = new Set<string>();
  const out: MetricId[] = [];
  for (const section of Array.isArray(template.sections)
    ? template.sections
    : []) {
    for (const id of Array.isArray(section.metricIds)
      ? section.metricIds
      : []) {
      if (registry[id] && !seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  }
  return out;
}

/**
 * Validates a requested metric selection and returns the deduped, sorted list to persist.
 * - Dedupe, then cap at {@link MAX_SELECTED_METRICS}.
 * - Finance metrics without `finance.read` are REJECTED (403), never silently dropped or included.
 * - Everything must be a subset of the template's allowed metrics (`isSubsetOfAllowed`).
 */
export function validateMetricSelection(input: {
  requested: readonly string[];
  allowed: readonly MetricId[];
  registry: MetricRegistry;
  canFinance: boolean;
  max?: number;
}): MetricId[] {
  const max = input.max ?? MAX_SELECTED_METRICS;
  const unique = [...new Set(input.requested.map((id) => id.trim()))].filter(
    (id) => id.length > 0,
  );
  if (unique.length === 0) {
    throw new BadRequestException({
      message: 'Select at least one metric',
      details: { reason: ReportApiReason.NO_METRICS },
    });
  }
  if (unique.length > max) {
    throw new BadRequestException({
      message: `Select at most ${max} metrics`,
      details: { reason: ReportApiReason.TOO_MANY_METRICS, max },
    });
  }
  if (!input.canFinance) {
    const financeRequested = unique.some((id) => {
      const def = input.registry[id];
      return def ? isFinanceMetric(def) : id.startsWith('finance.');
    });
    if (financeRequested) {
      throw new ForbiddenException({
        message: 'Finance metrics require finance access',
        details: { reason: ReportApiReason.FINANCE_FORBIDDEN },
      });
    }
  }
  if (!isSubsetOfAllowed(unique as MetricId[], input.allowed)) {
    throw new BadRequestException({
      message: 'One or more metrics are not available for this report',
      details: { reason: ReportApiReason.METRIC_NOT_ALLOWED },
    });
  }
  return (unique as MetricId[]).sort();
}

/** Stable identity of a scope for duplicate detection (`membershipAsOf` is intentionally ignored). */
export function scopeIdentity(scope: ReportScope): string {
  switch (scope.kind) {
    case 'SINGLE_COW':
      return `SINGLE_COW:${scope.cattleId}`;
    case 'GROUP':
      return `GROUP:${scope.groupId}`;
    default:
      return 'ALL_ELIGIBLE';
  }
}

export function sameMetricSet(
  a: readonly string[],
  b: readonly string[],
): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((id, i) => id === right[i]);
}
