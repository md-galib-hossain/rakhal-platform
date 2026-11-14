import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  formatPurchaseNumber,
  purchaseCounterScope,
} from '../domain/purchase-number';

/**
 * Atomic per-farm `Purchase.purchaseNumber` allocation (RAKHAL-348). Uses the
 * existing `FarmCounter` model via an upsert-inside-transaction — the exact
 * gapless/collision-free pattern `SaleNumberAllocator` (RAKHAL-339) already
 * uses, deliberately **not** `count()+1` (the V1 race this milestone exists
 * to fix, `finance.service.ts:1014-1023`). Must always be called on the same
 * `Prisma.TransactionClient` that creates the `Purchase` row — a
 * rolled-back create releases the number, a concurrent allocate call
 * serializes on the counter row's lock.
 */
@Injectable()
export class PurchaseNumberAllocator {
  async allocate(
    client: Prisma.TransactionClient,
    farmId: string,
  ): Promise<string> {
    const counter = await client.farmCounter.upsert({
      where: { scope: purchaseCounterScope(farmId) },
      create: { scope: purchaseCounterScope(farmId), value: 1 },
      update: { value: { increment: 1 } },
    });
    return formatPurchaseNumber(counter.value);
  }
}
