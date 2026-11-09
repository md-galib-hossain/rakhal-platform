"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePaymentTermsDays = parsePaymentTermsDays;
function parsePaymentTermsDays(text) {
    if (!text) {
        return 0;
    }
    const trimmed = text.trim().toLowerCase();
    if (trimmed === 'cod') {
        return 0;
    }
    const match = /^net[_-]?(\d+)$/.exec(trimmed);
    return match ? parseInt(match[1], 10) : 0;
}
//# sourceMappingURL=payment-terms.js.map