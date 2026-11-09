"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSaleParty = resolveSaleParty;
async function resolveSaleParty(client, customerId) {
    if (!customerId)
        return {};
    const buyer = await client.milkBuyer.findUnique({
        where: { id: customerId },
        select: { name: true },
    });
    if (!buyer)
        return {};
    return { partyId: customerId, partyName: buyer.name };
}
//# sourceMappingURL=resolve-sale-party.js.map