import { type BreedingStatus } from '../../../domain/eligibility';
import { type Money, type MoneyInput } from 'src/common/money';
import type { MetricValue } from '../../../domain/contracts/metric-value';
export declare const MIN_DECIDED_FOR_CONCEPTION_RATE = 5;
export declare const REPEATED_FAILED_SERVICES_THRESHOLD = 3;
export type ServiceMethod = 'AI' | 'NATURAL' | 'EMBRYO_TRANSFER';
export interface ServiceRow {
    cattleId: string;
    breedingMethod: ServiceMethod;
    status: BreedingStatus;
    voidedAt: Date | null;
    financeTransactionId: string | null;
    expectedPregnancyCheckDate: Date | null;
}
export interface ServiceAggregate {
    total: number;
    uniqueCows: number;
    byMethod: Record<ServiceMethod, {
        events: number;
        uniqueCows: number;
    }>;
    confirmed: number;
    pending: number;
    failed: number;
    other: number;
    decided: number;
    overdueChecks: number;
    dueForCheck: number;
    cowsWithRepeatedFailures: string[];
    aiWithoutCostLink: number;
}
export declare function isOverdueCheck(row: ServiceRow, now: Date): boolean;
export declare function aggregateServices(rows: readonly ServiceRow[], now: Date): ServiceAggregate;
export declare function conceptionRate(confirmed: number, failed: number, minDecided?: number): MetricValue;
export declare function sumLinkedCost(amounts: readonly MoneyInput[]): Money;
