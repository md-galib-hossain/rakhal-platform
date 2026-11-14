import { isTransientError, type ReportErrorCategory } from './contracts/enums';

/**
 * Thrown by the pipeline for a failure with a known category. The queue processor retries only
 * transient categories; a permanent one marks the report FAILED and is never retried.
 * `message` must be short and free of report content, ids of other tenants and stack traces: it is
 * persisted on `Report.errorMessage` and shown to the user.
 */
export class ReportError extends Error {
  constructor(
    readonly category: ReportErrorCategory,
    message: string,
  ) {
    super(message);
    this.name = 'ReportError';
  }

  get transient(): boolean {
    return isTransientError(this.category);
  }
}
