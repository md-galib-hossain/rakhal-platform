import { Prisma } from '@prisma/client';
export declare class SaleNumberAllocator {
    allocate(client: Prisma.TransactionClient, farmId: string): Promise<string>;
}
