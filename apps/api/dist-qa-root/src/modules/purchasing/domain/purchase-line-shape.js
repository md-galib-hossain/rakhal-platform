"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PURCHASE_NEW_ITEM_KINDS = void 0;
exports.validatePurchaseLineDetailShape = validatePurchaseLineDetailShape;
exports.PURCHASE_NEW_ITEM_KINDS = [
    'MEDICINE',
    'FEED',
    'EQUIPMENT',
];
function validatePurchaseLineDetailShape(line) {
    const sources = [
        line.medicineId,
        line.feedItemId,
        line.equipmentId,
        line.newItem,
    ].filter((v) => !!v);
    if (sources.length !== 1) {
        return 'A purchase line requires exactly one of medicineId, feedItemId, equipmentId, newItem';
    }
    if (line.newItem?.kind === 'FEED' &&
        !line.newItem.ingredientId &&
        !line.newItem.nutrition) {
        return 'A new feed item needs a nutrition profile or a catalogue ingredientId to copy it from';
    }
    return null;
}
//# sourceMappingURL=purchase-line-shape.js.map