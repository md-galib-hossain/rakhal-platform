"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INVOICE_COUNTER_SCOPE = void 0;
exports.formatInvoiceNumber = formatInvoiceNumber;
exports.INVOICE_COUNTER_SCOPE = 'invoice';
function formatInvoiceNumber(prefix, value) {
    return `${prefix}-${String(value).padStart(6, '0')}`;
}
//# sourceMappingURL=invoice-number.js.map