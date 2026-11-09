import { MilkSession } from '@prisma/client';
export declare const ANOMALY_THRESHOLD = 0.7;
export declare const DEFAULT_SESSION_CONFIG: MilkSession[];
export declare function isAnomaly(yieldL: number, avg7d: number | null, thresholdFraction?: number): boolean;
export declare function dropPct(yieldL: number, avg7d: number | null): number | null;
