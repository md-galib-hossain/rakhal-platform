export type PeriodErrorCode = 'INVALID_TIMEZONE' | 'INVALID_DATE' | 'INVALID_RANGE' | 'RANGE_TOO_LONG' | 'PERIOD_KIND_MISMATCH' | 'INVALID_PRESET';
export declare class PeriodError extends Error {
    readonly code: PeriodErrorCode;
    constructor(code: PeriodErrorCode, message: string);
}
export declare class InvalidTimezoneError extends PeriodError {
    constructor(timezone: string);
}
export declare class InvalidDateError extends PeriodError {
    constructor(value: string);
}
export declare class InvalidRangeError extends PeriodError {
    constructor(from: string, to: string);
}
export declare class InvalidPresetError extends PeriodError {
    constructor(detail: string);
}
export declare class RangeTooLongError extends PeriodError {
    constructor(days: number, max: number);
}
export declare class PeriodKindMismatchError extends PeriodError {
    constructor(kind: string, detected: string);
}
