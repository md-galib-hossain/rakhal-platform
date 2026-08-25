import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { formatSaleNumber, saleCounterScope } from '../domain/sale-number';

/**
 * Atomic per-farm `Sale.saleNumber` allocation (RAKHAL-339). Uses the existing
 * `FarmCounter` model (`prisma/schemas/farm/farm-counter.prisma`) via an
 * upsert-inside-transaction — the exact gapless/collision-free pattern
 * `FarmService.create` (farm code serial) and `FinancialAccountService`'s
 * `nextCustomLedgerCode` (RAKHAL-335) already use, deliberately **not**
 * `count()+1` (the V1 race this milestone exists to fix,
 * `finance.service.ts:1014-1023`). Must always be called on the same
 * `Prisma.TransactionClient` that creates the `Sale` row — a rolled-back create
 * releases the number, a concurrent allocate call serializes on the counter row's
 * lock.
 */
@Injectable()
export class SaleNumberAllocator {
  async allocate(
    client: Prisma.TransactionClient,
    farmId: string,
  ): Promise<string> {
    const counter = await client.farmCounter.upsert({
      where: { scope: saleCounterScope(farmId) },
      create: { scope: saleCounterScope(farmId), value: 1 },
      update: { value: { increment: 1 } },
    });
    return formatSaleNumber(counter.value);
  }
}
