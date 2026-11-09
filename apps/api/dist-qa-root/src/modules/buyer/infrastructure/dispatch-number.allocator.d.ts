import { Prisma } from '@prisma/client';
export declare class DispatchNumberAllocator {
    allocate(client: Prisma.TransactionClient, farmId: string): Promise<string>;
}
