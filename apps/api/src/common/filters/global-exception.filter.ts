import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggerService } from '../../core/logger/logger/logger.service';
import { BaseException } from '../exceptions/base.exception';
import { ExceptionCode } from '../exceptions/exception-codes.enum';
import { AppError } from 'src/common/exceptions/app.error';
import { env } from 'src/core/config/env';

interface AppRequest extends Request {
  requestId?: string;
  traceId?: string;
}
export interface ErrorResponse {
  success: false;
  error: {
    code: ExceptionCode;
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
  code: ExceptionCode;
  message: string;
  details?: Record<string, unknown>;
}

interface HttpExceptionResponse {
  message?: string | string[];
  error?: string;
  statusCode?: number;
  code?: unknown;
}

const INTERNAL_ERROR_MESSAGE = 'An unexpected error occurred';
const HTTP_EXCEPTION_CODE_BY_STATUS: Partial<Record<number, ExceptionCode>> = {
  [HttpStatus.BAD_REQUEST]: ExceptionCode.VALIDATION_ERROR,
  [HttpStatus.UNAUTHORIZED]: ExceptionCode.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ExceptionCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ExceptionCode.NOT_FOUND,
  [HttpStatus.CONFLICT]: ExceptionCode.CONFLICT,
};

@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<AppRequest>();
    const response = ctx.getResponse<Response>();

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
      const statusCode = exception.getStatus();

      return {
        statusCode,
        code: exception.code,
        message: this.getResponseMessage(statusCode, exception.message),
        details: exception.details,
      };
    }

    if (exception instanceof AppError) {
      return {
        statusCode: exception.statusCode,
        code: exception.code,
        message: this.getResponseMessage(
          exception.statusCode,
          exception.message,
        ),
        details: exception.details,
      };
    }

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();

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
        code: this.resolveHttpExceptionCode(exception, httpBody),
        message: this.getResponseMessage(exception.getStatus(), message),
      };
    }

    if (exception instanceof Error) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: ExceptionCode.INTERNAL_ERROR,
        message: INTERNAL_ERROR_MESSAGE,
        details:
          env.NODE_ENV === 'production'
            ? undefined
            : { stack: exception.stack },
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ExceptionCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
    };
  }

  private getResponseMessage(statusCode: number, message: string): string {
    if (statusCode >= 500 && env.NODE_ENV === 'production') {
      return INTERNAL_ERROR_MESSAGE;
    }

    return message;
  }

  private resolveHttpExceptionCode(
    exception: HttpException,
    response: HttpExceptionResponse,
  ): ExceptionCode {
    if (this.isExceptionCode(response.code)) return response.code;

    return (
      HTTP_EXCEPTION_CODE_BY_STATUS[exception.getStatus()] ??
      ExceptionCode.INTERNAL_ERROR
    );
  }

  private isExceptionCode(value: unknown): value is ExceptionCode {
    return (
      typeof value === 'string' &&
      Object.values(ExceptionCode).includes(value as ExceptionCode)
    );
  }
}
