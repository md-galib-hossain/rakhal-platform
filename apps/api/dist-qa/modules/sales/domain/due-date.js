"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveSaleDueDate = deriveSaleDueDate;
function deriveSaleDueDate(saleDate, paymentTermsDays) {
    if (!paymentTermsDays || paymentTermsDays <= 0) {
        return null;
    }
    const due = new Date(saleDate);
    due.setUTCDate(due.getUTCDate() + paymentTermsDays);
    return due;
}
//# sourceMappingURL=due-date.js.map