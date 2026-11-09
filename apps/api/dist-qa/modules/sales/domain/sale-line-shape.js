"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSaleLineDetailShape = validateSaleLineDetailShape;
const client_1 = require("@prisma/client");
function validateSaleLineDetailShape(line) {
    switch (line.type) {
        case client_1.SaleLineType.ANIMAL:
            return line.cattleId ? null : 'An ANIMAL sale line requires cattleId';
        case client_1.SaleLineType.INVENTORY: {
            const fks = [line.medicineId, line.feedItemId, line.equipmentId].filter((v) => !!v);
            return fks.length === 1
                ? null
                : 'An INVENTORY sale line requires exactly one of medicineId, feedItemId, equipmentId';
        }
        case client_1.SaleLineType.MILK:
        case client_1.SaleLineType.MANURE:
            return null;
    }
}
//# sourceMappingURL=sale-line-shape.js.map