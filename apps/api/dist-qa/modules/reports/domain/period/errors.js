"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeriodKindMismatchError = exports.RangeTooLongError = exports.InvalidPresetError = exports.InvalidRangeError = exports.InvalidDateError = exports.InvalidTimezoneError = exports.PeriodError = void 0;
class PeriodError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = new.target.name;
    }
}
exports.PeriodError = PeriodError;
class InvalidTimezoneError extends PeriodError {
    constructor(timezone) {
        super('INVALID_TIMEZONE', `Invalid IANA timezone: "${timezone}"`);
    }
}
exports.InvalidTimezoneError = InvalidTimezoneError;
class InvalidDateError extends PeriodError {
    constructor(value) {
        super('INVALID_DATE', `Invalid date (expected real YYYY-MM-DD): "${value}"`);
    }
}
exports.InvalidDateError = InvalidDateError;
class InvalidRangeError extends PeriodError {
    constructor(from, to) {
        super('INVALID_RANGE', `Range start ${from} is after end ${to}`);
    }
}
exports.InvalidRangeError = InvalidRangeError;
class InvalidPresetError extends PeriodError {
    constructor(detail) {
        super('INVALID_PRESET', detail);
    }
}
exports.InvalidPresetError = InvalidPresetError;
class RangeTooLongError extends PeriodError {
    constructor(days, max) {
        super('RANGE_TOO_LONG', `Range spans ${days} days; maximum is ${max}`);
    }
}
exports.RangeTooLongError = RangeTooLongError;
class PeriodKindMismatchError extends PeriodError {
    constructor(kind, detected) {
        super('PERIOD_KIND_MISMATCH', `Period kind "${kind}" is inconsistent with the period shape ("${detected}")`);
    }
}
exports.PeriodKindMismatchError = PeriodKindMismatchError;
//# sourceMappingURL=errors.js.map