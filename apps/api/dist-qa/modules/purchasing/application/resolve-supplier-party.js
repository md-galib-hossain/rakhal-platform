"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSupplierParty = resolveSupplierParty;
async function resolveSupplierParty(client, supplierId) {
    if (!supplierId)
        return {};
    const supplier = await client.supplier.findUnique({
        where: { id: supplierId },
        select: { name: true },
    });
    if (!supplier)
        return {};
    return { partyId: supplierId, partyName: supplier.name };
}
//# sourceMappingURL=resolve-supplier-party.js.map