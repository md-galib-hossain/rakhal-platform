import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '@prisma/client';
export declare const txStore: AsyncLocalStorage<{
    tx: Prisma.TransactionClient;
}>;
