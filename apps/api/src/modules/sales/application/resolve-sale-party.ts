import { Prisma } from '@prisma/client';

/**
 * RD-069 — every `SALE` `postJournal` call site needs the same lookup: a
 * sale's buyer (`MilkBuyer`, aliased `customer` — see `sale.prisma`'s own
 * doc comment) resolved to `{ partyId, partyName }` for the
 * `FinancialDocument` projection, or neither key at all for a walk-up sale
 * with no `customerId`. One tiny extra query at write time (sales are not a
 * hot path) buys `TransactionFeedService` a zero-join read.
 */
export async function resolveSaleParty(
  client: Prisma.TransactionClient,
  customerId: string | null,
): Promise<{ partyId?: string; partyName?: string }> {
  if (!customerId) return {};
  const buyer = await client.milkBuyer.findUnique({
    where: { id: customerId },
    select: { name: true },
  });
  if (!buyer) return {};
  return { partyId: customerId, partyName: buyer.name };
}
