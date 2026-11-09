import { Prisma } from '@prisma/client';
export declare function resolveSaleParty(client: Prisma.TransactionClient, customerId: string | null): Promise<{
    partyId?: string;
    partyName?: string;
}>;
