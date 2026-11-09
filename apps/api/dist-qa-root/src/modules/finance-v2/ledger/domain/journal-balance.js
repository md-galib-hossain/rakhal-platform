"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JournalNotFoundError = exports.JournalAlreadyReversedError = exports.JournalInvalidLineError = exports.JournalEmptyError = exports.JournalUnbalancedError = void 0;
exports.assertBalanced = assertBalanced;
exports.mirrorForReversal = mirrorForReversal;
const money_1 = require("src/common/money");
class JournalUnbalancedError extends Error {
    totalDebit;
    totalCredit;
    constructor(totalDebit, totalCredit) {
        super(`Journal posting is unbalanced: total debit ${totalDebit} !== total credit ${totalCredit}`);
        this.totalDebit = totalDebit;
        this.totalCredit = totalCredit;
        this.name = 'JournalUnbalancedError';
    }
}
exports.JournalUnbalancedError = JournalUnbalancedError;
class JournalEmptyError extends Error {
    constructor() {
        super('Journal posting must have at least one entry line');
        this.name = 'JournalEmptyError';
    }
}
exports.JournalEmptyError = JournalEmptyError;
class JournalInvalidLineError extends Error {
    constructor(message) {
        super(message);
        this.name = 'JournalInvalidLineError';
    }
}
exports.JournalInvalidLineError = JournalInvalidLineError;
function assertBalanced(entries) {
    if (entries.length === 0) {
        throw new JournalEmptyError();
    }
    for (const entry of entries) {
        const debit = (0, money_1.toMoney)(entry.debit ?? 0);
        const credit = (0, money_1.toMoney)(entry.credit ?? 0);
        if ((0, money_1.isNegative)(debit) || (0, money_1.isNegative)(credit)) {
            throw new JournalInvalidLineError(`Journal entry line for ledger account ${entry.ledgerAccountId} has a negative debit/credit`);
        }
        if (!(0, money_1.eq)(debit, 0) && !(0, money_1.eq)(credit, 0)) {
            throw new JournalInvalidLineError(`Journal entry line for ledger account ${entry.ledgerAccountId} carries both a debit and a credit — a line must be one or the other`);
        }
    }
    const totalDebit = (0, money_1.sum)(entries.map((entry) => entry.debit ?? 0));
    const totalCredit = (0, money_1.sum)(entries.map((entry) => entry.credit ?? 0));
    if (!(0, money_1.eq)(totalDebit, totalCredit)) {
        throw new JournalUnbalancedError(totalDebit.toFixed(2), totalCredit.toFixed(2));
    }
}
function mirrorForReversal(entries) {
    return entries.map((entry) => ({
        ledgerAccountId: entry.ledgerAccountId,
        debit: entry.credit ?? 0,
        credit: entry.debit ?? 0,
    }));
}
class JournalAlreadyReversedError extends Error {
    constructor(journalTransactionId) {
        super(`Journal transaction ${journalTransactionId} has already been reversed`);
        this.name = 'JournalAlreadyReversedError';
    }
}
exports.JournalAlreadyReversedError = JournalAlreadyReversedError;
class JournalNotFoundError extends Error {
    constructor(journalTransactionId) {
        super(`Journal transaction ${journalTransactionId} not found`);
        this.name = 'JournalNotFoundError';
    }
}
exports.JournalNotFoundError = JournalNotFoundError;
//# sourceMappingURL=journal-balance.js.map