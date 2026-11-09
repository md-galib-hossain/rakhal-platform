import { LoggerService as NestLoggerService } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { LoggerContext } from 'src/core/logger/logger/logger.context';
export declare class LoggerService implements NestLoggerService {
    private readonly pino;
    private readonly loggerContext?;
    private context?;
    constructor(pino: PinoLogger, loggerContext?: LoggerContext | undefined);
    setContext(context: string): this;
    private mergeContext;
    private serializeError;
    private formatMessage;
    private formatUnknown;
    trace(msg: string, meta?: Record<string, unknown>): void;
    debug(msg: string, meta?: Record<string, unknown>): void;
    info(msg: string, meta?: Record<string, unknown>): void;
    warn(message: unknown, context?: string): void;
    warn(msg: string, meta?: Record<string, unknown>): void;
    error(message: unknown, stack?: unknown, context?: string): void;
    error(msg: string, error?: unknown, meta?: Record<string, unknown>): void;
    fatal(msg: string, error?: unknown, meta?: Record<string, unknown>): void;
    audit(action: string, meta: Record<string, unknown>): void;
    log(msg: string, context?: string): void;
    verbose(msg: string, context?: string): void;
}
