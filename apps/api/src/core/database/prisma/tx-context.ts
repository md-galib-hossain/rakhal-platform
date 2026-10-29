import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '@prisma/client';

/**
 * RAKHAL-481 follow-up: when set, `PrismaService` resolves model delegates,
 * raw queries and `$transaction()` to this one interactive transaction, so
 * existing services join it without taking a `tx` parameter. Only the event
 * write API sets it; every other request is unaffected.
 */
export const txStore = new AsyncLocalStorage<{
  tx: Prisma.TransactionClient;
}>();
