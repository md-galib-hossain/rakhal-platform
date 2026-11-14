import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  formatDispatchNumber,
  dispatchCounterScope,
} from '../domain/dispatch-number';

/**
 * Atomic per-farm `MilkDispatch.dispatchNumber` allocation (RAKHAL-366).
 * Verbatim copy of `sales/infrastructure/sale-number.allocator.ts`'s
 * `FarmCounter` upsert-inside-transaction pattern — deliberately not
 * `count()+1`. Must always be called on the same `Prisma.TransactionClient`
 * that creates the `MilkDispatch` row, same as `SaleNumberAllocator`.
 */
@Injectable()
export class DispatchNumberAllocator {
  async allocate(
    client: Prisma.TransactionClient,
    farmId: string,
  ): Promise<string> {
    const counter = await client.farmCounter.upsert({
      where: { scope: dispatchCounterScope(farmId) },
      create: { scope: dispatchCounterScope(farmId), value: 1 },
      update: { value: { increment: 1 } },
    });
    return formatDispatchNumber(counter.value);
  }
}
