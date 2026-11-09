"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertSupplierBelongsToFarm = assertSupplierBelongsToFarm;
const common_1 = require("@nestjs/common");
async function assertSupplierBelongsToFarm(client, farmId, supplierId) {
    const supplier = await client.supplier.findFirst({
        where: { id: supplierId, farmId, deletedAt: null },
        select: { id: true },
    });
    if (!supplier) {
        throw new common_1.BadRequestException('supplierId not found for this farm');
    }
}
//# sourceMappingURL=assert-supplier-in-farm.js.map