import {
  Injectable,
  LoggerService as NestLoggerService,
  Optional,
  Scope,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { LoggerContext } from 'src/core/logger/logger/logger.context';

@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService implements NestLoggerService {
  // Label attached to every log line from this instance (e.g. 'UserService')
  private context?: string;

  constructor(
    private readonly pino: PinoLogger,
    // Optional: no active context exists during bootstrap (before request lifecycle)
    @Optional() private readonly loggerContext?: LoggerContext,
  ) {}

  // ─── Context Management ───────────────────────────────────────────────────

  // Call once in constructor of consuming class: this.logger.setContext(MyService.name)
  setContext(context: string): this {
    this.context = context;
    this.pino.setContext(context);
    return this;
  }

  // Pulls requestId, traceId, userId, tenantId from AsyncLocalStorage and merges with log obj
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

  // ─── Application Log Methods (use these in your own code) ─────────────────

  // Finest-grained — use for internal flow tracing during development
  trace(msg: string, obj?: object): void {
    this.pino.trace(this.mergeContext(obj), msg);
  }

  // Use for debugging values, state, and branching logic
  debug(msg: string, obj?: object): void {
    this.pino.debug(this.mergeContext(obj), msg);
  }

  // Use for normal operational events (user created, job started, etc.)
  info(msg: string, obj?: object): void {
    this.pino.info(this.mergeContext(obj), msg);
  }

  // Use for unexpected but recoverable situations
  warn(msg: string, obj?: object): void {
    this.pino.warn(this.mergeContext(obj), msg);
  }

  // Use for caught exceptions — automatically extracts message, stack, name from Error
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

  // Use for critical failures that may require process restart
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

  // Structured audit trail — tagged with audit:true for log pipeline filtering
  audit(action: string, meta: Record<string, unknown>): void {
    this.pino.info(
      { ...this.mergeContext(), audit: true, action, ...meta },
      `AUDIT: ${action}`,
    );
  }

  // ─── NestJS LoggerService Adapters (do NOT call these in code) ───
  // NestJS internals call these for system-level logs (bootstrap, route registration, etc.)

  // NestJS log() → maps to pino info
  log(msg: string, context?: string): void {
    this.pino.info(
      this.mergeContext({ context: context ?? this.context }),
      msg,
    );
  }

  // NestJS verbose() → maps to pino trace
  verbose(msg: string, context?: string): void {
    this.pino.trace(
      this.mergeContext({ context: context ?? this.context }),
      msg,
    );
  }
}
