import { OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { SourceResolverRegistry } from 'src/modules/notification/application/resolvers/source-resolver.registry';
import type { ResolveContext, ResolverSourceType, SourceResolution, SourceResolver } from 'src/modules/notification/application/resolvers/source-resolver.port';
export interface StepGroupRef {
    kind: 'round' | 'case';
    id: string;
    ymd: string;
}
export declare function stepSourceKey(ref: StepGroupRef): string;
export declare function parseStepSourceKey(key: string): StepGroupRef | null;
declare const STEP_SELECT: {
    id: true;
    cattleId: true;
    title: true;
    dueDateTime: true;
    timeOfDay: true;
    healthCaseId: true;
    cattle: {
        select: {
            name: true;
            tagNumber: true;
            herdStatus: true;
            deletedAt: true;
        };
    };
    healthCase: {
        select: {
            healthPlan: {
                select: {
                    name: true;
                };
            };
        };
    };
    planEnrollment: {
        select: {
            planApplicationId: true;
            healthPlan: {
                select: {
                    name: true;
                };
            };
        };
    };
    healthPlan: {
        select: {
            name: true;
        };
    };
};
export type StepRow = Prisma.HealthTaskGetPayload<{
    select: typeof STEP_SELECT;
}>;
export interface StepGroup {
    ref: StepGroupRef;
    open: StepRow[];
    live: StepRow[];
}
export declare class HealthStepSourceResolver implements SourceResolver, OnModuleInit {
    private readonly prisma;
    private readonly registry;
    readonly sourceType: ResolverSourceType;
    constructor(prisma: PrismaService, registry: SourceResolverRegistry);
    onModuleInit(): void;
    loadGroup(farmId: string, ref: StepGroupRef, timezone: string): Promise<StepGroup>;
    resolve(ctx: ResolveContext): Promise<SourceResolution>;
}
export declare function stepGroupLabel(group: StepGroup): string;
export {};
