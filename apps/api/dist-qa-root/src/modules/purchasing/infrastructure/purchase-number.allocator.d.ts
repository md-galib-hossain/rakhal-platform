import { Prisma } from '@prisma/client';
export declare class PurchaseNumberAllocator {
    allocate(client: Prisma.TransactionClient, farmId: string): Promise<string>;
}
