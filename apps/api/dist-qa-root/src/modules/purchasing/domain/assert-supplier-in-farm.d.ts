import { Prisma } from '@prisma/client';
export declare function assertSupplierBelongsToFarm(client: Prisma.TransactionClient, farmId: string, supplierId: string): Promise<void>;
