import { OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import type { AnchorChecker } from 'src/modules/notification/application/resolvers/source-resolver.port';
import { SourceResolverRegistry } from 'src/modules/notification/application/resolvers/source-resolver.registry';
export declare class AnimalEventAnchorChecker implements AnchorChecker, OnModuleInit {
    private readonly prisma;
    private readonly registry;
    readonly anchorType: "ANIMAL_EVENT";
    constructor(prisma: PrismaService, registry: SourceResolverRegistry);
    onModuleInit(): void;
    exists(farmId: string, anchorId: string): Promise<boolean>;
}
