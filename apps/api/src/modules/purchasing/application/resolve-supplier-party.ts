import { Prisma } from '@prisma/client';

/**
 * RD-069 — the `PURCHASE`/`EXPENSE` mirror of `sales/application/
 * resolve-sale-party.ts`: resolves a `Supplier` id to `{ partyId, partyName }`
 * for the `FinancialDocument` projection written alongside the posting, or
 * neither key when the document has no supplier (a cash purchase, a general
 * farm expense with no vendor).
 */
export async function resolveSupplierParty(
  client: Prisma.TransactionClient,
  supplierId: string | null | undefined,
): Promise<{ partyId?: string; partyName?: string }> {
  if (!supplierId) return {};
  const supplier = await client.supplier.findUnique({
    where: { id: supplierId },
    select: { name: true },
  });
  if (!supplier) return {};
  return { partyId: supplierId, partyName: supplier.name };
}
