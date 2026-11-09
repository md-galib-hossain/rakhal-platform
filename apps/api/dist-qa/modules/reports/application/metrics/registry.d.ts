import type { MetricRegistry } from '../../domain/contracts/metric-definition';
import type { ReportDomain } from '../../domain/contracts/enums';
import type { DomainMetricModule } from './metric-context';
export declare const METRIC_MODULES: Readonly<Partial<Record<ReportDomain, DomainMetricModule>>>;
export declare function buildMetricRegistry(modules?: Readonly<Partial<Record<ReportDomain, DomainMetricModule>>>): MetricRegistry;
export declare const METRIC_REGISTRY: MetricRegistry;
