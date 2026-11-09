"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PARTY_RESOLVABLE_SOURCE_TYPES = exports.TRANSACTION_SOURCE_REGISTRY = void 0;
exports.describeSourceType = describeSourceType;
exports.TRANSACTION_SOURCE_REGISTRY = {
    SALE: { label: 'Sale', buildHref: (id) => `/sales/${id}` },
    PURCHASE: { label: 'Purchase', buildHref: (id) => `/purchasing/${id}` },
    EXPENSE: {
        label: 'Expense',
        buildHref: (id) => `/purchasing/expenses/${id}`,
    },
    FINANCE_PAYMENT: {
        label: 'Payment',
        buildHref: (id) => `/finance/payments/${id}`,
    },
    FINANCE_TRANSFER: {
        label: 'Transfer',
        buildHref: (id) => `/finance/transfers/${id}`,
    },
    OTHER_INCOME: {
        label: 'Other Income',
        buildHref: (id) => `/finance/other-income/${id}`,
    },
    FINANCIAL_ACCOUNT_OPENING_BALANCE: {
        label: 'Opening Balance',
        buildHref: () => null,
    },
    FEED_MIXTURE_FINALIZE: {
        label: 'Feed Mixture',
        buildHref: (id) => `/feed/formulator/${id}`,
    },
    FEED_CONCENTRATE_FINALIZE: {
        label: 'Concentrate Mixer',
        buildHref: (id) => `/feed/formulator/${id}`,
    },
};
exports.PARTY_RESOLVABLE_SOURCE_TYPES = [
    'SALE',
    'PURCHASE',
    'EXPENSE',
];
function describeSourceType(sourceType) {
    return (exports.TRANSACTION_SOURCE_REGISTRY[sourceType] ?? {
        label: sourceType,
        buildHref: () => null,
    });
}
//# sourceMappingURL=transaction-source.js.map