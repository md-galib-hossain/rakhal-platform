import { ExceptionFilter, ArgumentsHost } from '@nestjs/common';
import { LoggerService } from '../../core/logger/logger/logger.service';
import { ExceptionCode } from '../exceptions/exception-codes.enum';
import { SentryService } from 'src/core/observability/sentry/sentry.service';
import { I18nService } from 'src/common/i18n/i18n.service';
export interface ErrorResponse {
    success: false;
    message: string;
    code: ExceptionCode;
    requestId: string;
    timestamp: string;
    details?: Record<string, unknown>;
}
export declare class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger;
    private readonly sentry;
    private readonly i18n;
    constructor(logger: LoggerService, sentry: SentryService, i18n: I18nService);
    catch(exception: unknown, host: ArgumentsHost): void;
    private resolveException;
    private getResponseMessage;
    private resolveHttpExceptionCode;
    private isExceptionCode;
}
