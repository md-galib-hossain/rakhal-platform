import { Prisma } from '@prisma/client';
export declare function resolveSupplierParty(client: Prisma.TransactionClient, supplierId: string | null | undefined): Promise<{
    partyId?: string;
    partyName?: string;
}>;
