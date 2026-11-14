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
        farmId: ctx.tenantId,
        tenantId: ctx.tenantId,
        service: 'rakhal-api',
      }),
      ...(ctx === undefined && { service: 'rakhal-api' }),
      context: this.context,
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

    try {
      return { err: { raw: JSON.stringify(error) } };
    } catch {
      return { err: { raw: this.formatUnknown(error) } };
    }
  }

  private formatMessage(message: unknown): string {
    if (typeof message === 'string') return message;

    try {
      return JSON.stringify(message) ?? this.formatUnknown(message);
    } catch {
      return this.formatUnknown(message);
    }
  }

  private formatUnknown(value: unknown): string {
    if (typeof value === 'string') return value;
    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint' ||
      typeof value === 'symbol'
    ) {
      return value.toString();
    }
    if (value instanceof Error) return value.message;

    return '[Unserializable value]';
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
  warn(message: unknown, context?: string): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  warn(
    message: unknown,
    metaOrContext?: Record<string, unknown> | string,
  ): void {
    if (typeof metaOrContext === 'string') {
      this.pino.warn(
        this.mergeContext({ context: metaOrContext ?? this.context }),
        this.formatMessage(message),
      );
      return;
    }

    this.pino.warn(
      this.mergeContext(metaOrContext),
      this.formatMessage(message),
    );
  }

  error(message: unknown, stack?: unknown, context?: string): void;
  error(msg: string, error?: unknown, meta?: Record<string, unknown>): void;
  error(
    message: unknown,
    errorOrStack?: unknown,
    metaOrContext?: Record<string, unknown> | string,
  ): void {
    if (typeof metaOrContext === 'string') {
      this.pino.error(
        this.mergeContext({ context: metaOrContext ?? this.context }),
        this.formatMessage(message),
      );
      return;
    }

    this.pino.error(
      {
        ...this.mergeContext(metaOrContext),
        ...this.serializeError(errorOrStack),
      },
      this.formatMessage(message),
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
