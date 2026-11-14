/** Typed errors for period resolution (RPT-02). Pure: callers map them to HTTP errors. */

export type PeriodErrorCode =
  | 'INVALID_TIMEZONE'
  | 'INVALID_DATE'
  | 'INVALID_RANGE'
  | 'RANGE_TOO_LONG'
  | 'PERIOD_KIND_MISMATCH'
  | 'INVALID_PRESET';

export class PeriodError extends Error {
  constructor(
    readonly code: PeriodErrorCode,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidTimezoneError extends PeriodError {
  constructor(timezone: string) {
    super('INVALID_TIMEZONE', `Invalid IANA timezone: "${timezone}"`);
  }
}

export class InvalidDateError extends PeriodError {
  constructor(value: string) {
    super(
      'INVALID_DATE',
      `Invalid date (expected real YYYY-MM-DD): "${value}"`,
    );
  }
}

export class InvalidRangeError extends PeriodError {
  constructor(from: string, to: string) {
    super('INVALID_RANGE', `Range start ${from} is after end ${to}`);
  }
}

export class InvalidPresetError extends PeriodError {
  constructor(detail: string) {
    super('INVALID_PRESET', detail);
  }
}

export class RangeTooLongError extends PeriodError {
  constructor(days: number, max: number) {
    super('RANGE_TOO_LONG', `Range spans ${days} days; maximum is ${max}`);
  }
}

export class PeriodKindMismatchError extends PeriodError {
  constructor(kind: string, detected: string) {
    super(
      'PERIOD_KIND_MISMATCH',
      `Period kind "${kind}" is inconsistent with the period shape ("${detected}")`,
    );
  }
}
