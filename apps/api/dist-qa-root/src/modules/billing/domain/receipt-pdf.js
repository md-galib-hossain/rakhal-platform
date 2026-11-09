"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildReceiptReportData = buildReceiptReportData;
function money(currency, amount) {
    return `${currency} ${amount.toFixed(2)}`;
}
function buildReceiptReportData(input) {
    const summary = [
        { label: 'Receipt No', value: input.invoiceNumber },
        { label: 'Status', value: input.status },
        { label: 'Issued', value: input.paidAt ?? input.issuedAt },
        { label: 'Seller', value: input.sellerName },
        { label: 'Seller Address', value: input.sellerAddress },
        ...(input.sellerBin
            ? [{ label: 'Seller BIN', value: input.sellerBin }]
            : []),
        { label: 'Billed To', value: input.buyerName },
        { label: 'Place of Supply', value: input.placeOfSupply },
    ];
    const rows = [
        [
            `${input.planName} subscription (${input.billingPeriod.toLowerCase()})`,
            money(input.currency, input.subtotal),
        ],
    ];
    if (input.discountTotal > 0) {
        rows.push(['Discount', `- ${money(input.currency, input.discountTotal)}`]);
    }
    if (input.referralCreditApplied > 0) {
        rows.push([
            'Rakhal Credit applied',
            `- ${money(input.currency, input.referralCreditApplied)}`,
        ]);
    }
    if (input.taxAmount > 0) {
        rows.push([
            `VAT (${input.taxRate}%)`,
            money(input.currency, input.taxAmount),
        ]);
    }
    rows.push(['Total paid', money(input.currency, input.total)]);
    return {
        title: 'Payment Receipt',
        period: `Invoice ${input.invoiceNumber}`,
        summary,
        columns: ['Description', 'Amount'],
        rows,
    };
}
//# sourceMappingURL=receipt-pdf.js.map