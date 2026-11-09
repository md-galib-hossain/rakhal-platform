import { OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import type { ResolveContext, SourceResolution, SourceResolver } from 'src/modules/notification/application/resolvers/source-resolver.port';
import { SourceResolverRegistry } from 'src/modules/notification/application/resolvers/source-resolver.registry';
export type TaskSourceKey = {
    kind: 'id';
    taskId: string;
} | {
    kind: 'rule';
    ruleKey: string;
    ymd: string;
};
export declare const plainTaskKey: (taskId: string) => string;
export declare const ruleTaskKey: (ruleKey: string, ymd: string) => string;
export declare function parseTaskSourceKey(key: string): TaskSourceKey | null;
export declare class TaskSourceResolver implements SourceResolver, OnModuleInit {
    private readonly prisma;
    private readonly registry;
    readonly sourceType: "TASK";
    constructor(prisma: PrismaService, registry: SourceResolverRegistry);
    onModuleInit(): void;
    resolve(ctx: ResolveContext): Promise<SourceResolution>;
    private openRows;
    private cattleIdsOf;
    private action;
}
