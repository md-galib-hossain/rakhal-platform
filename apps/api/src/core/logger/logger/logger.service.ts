import {
  Injectable,
  LoggerService as NestLoggerService,
  Optional,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { LoggerContext } from 'src/core/logger/logger/logger.context';

@Injectable()
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
  private mergeContext(
    meta?: Record<string, unknown>,
  ): Record<string, unknown> {
    const ctx = this.loggerContext?.get();
    return {
      ...(ctx && {
        requestId: ctx.requestId,
        traceId: ctx.traceId,
        userId: ctx.userId,
        tenantId: ctx.tenantId,
      }),
      ...meta,
    };
  }

  private serializeError(error: unknown): object {
    if (error === undefined || error === null) return {};

    // ✅ Duck-type check — bypasses instanceof cross-module failure
    if (typeof error === 'object' && 'message' in error && 'stack' in error) {
      const e = error as Error & {
        statusCode?: number;
        code?: string;
        details?: Record<string, unknown>;
      };

      return {
        err: {
          name: e.name ?? 'Error',
          message: e.message,
          stack: e.stack,
          ...(e.statusCode !== undefined && { statusCode: e.statusCode }),
          ...(e.code !== undefined && { code: e.code }),
          ...(e.details !== undefined && { details: e.details }),
        },
      };
    }

    return { err: { raw: JSON.stringify(error) } };
  }

  // ─── Application Log Methods (use these in your own code) ─────────────────

  // Finest-grained — use for internal flow tracing during development
  trace(msg: string, meta?: Record<string, unknown>): void {
    this.pino.trace(this.mergeContext(meta), msg);
  }
  // Use for debugging values, state, and branching logic
  debug(msg: string, meta?: Record<string, unknown>): void {
    this.pino.debug(this.mergeContext(meta), msg);
  }
  // Use for normal operational events (user created, job started, etc.)
  info(msg: string, meta?: Record<string, unknown>): void {
    this.pino.info(this.mergeContext(meta), msg);
  }

  // Use for unexpected but recoverable situations
  warn(msg: string, meta?: Record<string, unknown>): void {
    this.pino.warn(this.mergeContext(meta), msg);
  }
  error(msg: string, error?: unknown, meta?: Record<string, unknown>): void {
    this.pino.error(
      { ...this.mergeContext(meta), ...this.serializeError(error) },
      msg,
    );
  }

  fatal(msg: string, error?: unknown, meta?: Record<string, unknown>): void {
    this.pino.fatal(
      { ...this.mergeContext(meta), ...this.serializeError(error) },
      msg,
    );
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
