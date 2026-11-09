import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { databaseConfig } from 'src/core/config/env';
export declare class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly pool;
    constructor(dbConfig: ConfigType<typeof databaseConfig>);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
}
