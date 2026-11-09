import type { PrismaService } from 'src/core/database/prisma/prisma.service';
export interface RunwayThresholds {
    warningDays: number;
    criticalDays: number;
}
export interface RunwaySnapshot {
    days: number | null;
    status: 'unknown' | 'critical' | 'warning' | 'healthy';
}
export declare function computeRunwaySnapshot(prisma: PrismaService, farmId: string, liquidity: number, thresholds: RunwayThresholds, now?: Date): Promise<RunwaySnapshot>;
