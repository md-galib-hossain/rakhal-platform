"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.derivePayableDueDate = derivePayableDueDate;
function derivePayableDueDate(documentDate, paymentTermsDays) {
    if (!paymentTermsDays || paymentTermsDays <= 0) {
        return null;
    }
    const due = new Date(documentDate);
    due.setUTCDate(due.getUTCDate() + paymentTermsDays);
    return due;
}
//# sourceMappingURL=due-date.js.map