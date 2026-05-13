import { Injectable, Optional, Scope } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { LoggerContext } from 'src/core/logger/logger/logger.context';

@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService {
  private context?: string;

  constructor(
    private readonly pino: PinoLogger,
    @Optional() private readonly loggerContext?: LoggerContext,
  ) {}

  setContext(context: string): this {
    this.context = context;
    this.pino.setContext(context);
    return this;
  }

  private mergeContext(obj?: object): object {
    const ctx = this.loggerContext?.get();
    return {
      ...(ctx && {
        requestId: ctx.requestId,
        traceId: ctx.traceId,
        userId: ctx.userId,
        tenantId: ctx.tenantId,
      }),
      ...obj,
    };
  }

  trace(msg: string, obj?: object): void {
    this.pino.trace(this.mergeContext(obj), msg);
  }

  debug(msg: string, obj?: object): void {
    this.pino.debug(this.mergeContext(obj), msg);
  }

  info(msg: string, obj?: object): void {
    this.pino.info(this.mergeContext(obj), msg);
  }

  warn(msg: string, obj?: object): void {
    this.pino.warn(this.mergeContext(obj), msg);
  }

  error(msg: string, error?: unknown, obj?: object): void {
    const err =
      error instanceof Error
        ? {
            err: {
              message: error.message,
              stack: error.stack,
              name: error.name,
            },
          }
        : { err: error };

    this.pino.error({ ...this.mergeContext(obj), ...err }, msg);
  }

  fatal(msg: string, error?: unknown, obj?: object): void {
    const err =
      error instanceof Error
        ? {
            err: {
              message: error.message,
              stack: error.stack,
              name: error.name,
            },
          }
        : { err: error };

    this.pino.fatal({ ...this.mergeContext(obj), ...err }, msg);
  }

  /** Structured audit log — persisted separately in production pipelines */
  audit(action: string, meta: Record<string, unknown>): void {
    this.pino.info(
      {
        ...this.mergeContext(),
        audit: true,
        action,
        ...meta,
      },
      `AUDIT: ${action}`,
    );
  }
}
