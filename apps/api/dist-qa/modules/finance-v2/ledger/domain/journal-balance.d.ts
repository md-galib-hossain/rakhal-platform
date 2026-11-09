import { MoneyInput } from 'src/common/money';
export interface JournalEntryLineInput {
    ledgerAccountId: string;
    debit?: MoneyInput;
    credit?: MoneyInput;
}
export declare class JournalUnbalancedError extends Error {
    readonly totalDebit: string;
    readonly totalCredit: string;
    constructor(totalDebit: string, totalCredit: string);
}
export declare class JournalEmptyError extends Error {
    constructor();
}
export declare class JournalInvalidLineError extends Error {
    constructor(message: string);
}
export declare function assertBalanced(entries: readonly JournalEntryLineInput[]): void;
export declare function mirrorForReversal(entries: readonly JournalEntryLineInput[]): JournalEntryLineInput[];
export declare class JournalAlreadyReversedError extends Error {
    constructor(journalTransactionId: string);
}
export declare class JournalNotFoundError extends Error {
    constructor(journalTransactionId: string);
}
