import type {
  MetricDefinition,
  MetricRegistry,
} from '../../domain/contracts/metric-definition';
import type { ReportDomain } from '../../domain/contracts/enums';
import type { DomainMetricModule } from './metric-context';
import { feedMetricModule } from './feed';
import { financeMetricModule } from './finance';
import { healthMetricModule } from './health';
import { milkMetricModule } from './milk';
import { reproMetricModule } from './repro';

/** The compute modules, keyed by the domain whose section they build. */
export const METRIC_MODULES: Readonly<
  Partial<Record<ReportDomain, DomainMetricModule>>
> = {
  milk: milkMetricModule,
  health: healthMetricModule,
  reproduction: reproMetricModule,
  finance: financeMetricModule,
  feed: feedMetricModule,
};

/**
 * Every metric definition, keyed by id. Built once from the modules so the registry can never
 * disagree with what the modules compute. Throws on a duplicate id.
 */
export function buildMetricRegistry(
  modules: Readonly<
    Partial<Record<ReportDomain, DomainMetricModule>>
  > = METRIC_MODULES,
): MetricRegistry {
  const registry: Record<string, MetricDefinition> = {};
  for (const mod of Object.values(modules)) {
    if (!mod) continue;
    for (const def of mod.definitions) {
      if (registry[def.id]) throw new Error(`Duplicate metric id "${def.id}"`);
      registry[def.id] = def;
    }
  }
  return registry;
}

export const METRIC_REGISTRY: MetricRegistry = buildMetricRegistry();
