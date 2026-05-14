import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggerService } from '../../core/logger/logger/logger.service';
import { BaseException } from '../exceptions/base.exception';
import { ExceptionCode } from '../exceptions/exception-codes.enum';

interface AppRequest extends Request {
  requestId?: string;
  traceId?: string;
}
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    statusCode: number;
    details?: Record<string, unknown>;
    timestamp: string;
    path: string;
    requestId: string;
    traceId: string;
  };
}

interface ResolvedExceptionResult {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

interface HttpExceptionResponse {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<AppRequest>();
    const response = ctx.getResponse<Response>();

    // ✅ No more `any` cast — Request is now extended above
    const requestId = request.requestId ?? 'unknown';
    const traceId = request.traceId ?? 'unknown';

    const { statusCode, code, message, details } =
      this.resolveException(exception);

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code,
        message,
        statusCode,
        details,
        timestamp: new Date().toISOString(),
        path: request.url,
        requestId,
        traceId,
      },
    };

    if (statusCode >= 500) {
      // ✅ Removed unnecessary `as Error` cast — logger.error accepts `unknown`
      this.logger.error('Unhandled exception', exception, {
        requestId,
        traceId,
        path: request.url,
        method: request.method,
      });
    } else {
      this.logger.warn('Client error', {
        code,
        message,
        statusCode,
        path: request.url,
      });
    }

    response.status(statusCode).json(errorResponse);
  }

  private resolveException(exception: unknown): ResolvedExceptionResult {
    if (exception instanceof BaseException) {
      return {
        statusCode: exception.getStatus(),
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();

      // ✅ Properly typed — no more unsafe `any` assignment
      const httpBody: HttpExceptionResponse =
        typeof exceptionResponse === 'object' && exceptionResponse !== null
          ? exceptionResponse
          : { message: exception.message };

      const rawMessage = httpBody.message ?? exception.message;
      const message = Array.isArray(rawMessage)
        ? rawMessage.join(', ')
        : rawMessage;

      return {
        statusCode: exception.getStatus(),
        code: ExceptionCode.VALIDATION_ERROR,
        message,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ExceptionCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
    };
  }
}
