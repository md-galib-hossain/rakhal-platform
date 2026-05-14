import { HttpStatus } from '@nestjs/common';
import { ExceptionCode } from './exception-codes.enum';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ExceptionCode;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR,
    code: ExceptionCode = ExceptionCode.INTERNAL_ERROR,
    details?: Record<string, unknown>,
  ) {
    super(message);

    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;

    // ✅ Fixes prototype chain broken by extending built-ins in TypeScript
    Object.setPrototypeOf(this, new.target.prototype);
  }

  // ─── Static factory helpers ───────────────────────────────────────────────

  static badRequest(
    message: string,
    code = ExceptionCode.VALIDATION_ERROR,
    details?: Record<string, unknown>,
  ): AppError {
    return new AppError(message, HttpStatus.BAD_REQUEST, code, details);
  }

  static unauthorized(
    message = 'Unauthorized',
    code = ExceptionCode.UNAUTHORIZED,
  ): AppError {
    return new AppError(message, HttpStatus.UNAUTHORIZED, code);
  }

  static forbidden(
    message = 'Forbidden',
    code = ExceptionCode.FORBIDDEN,
  ): AppError {
    return new AppError(message, HttpStatus.FORBIDDEN, code);
  }

  static notFound(
    message = 'Resource not found',
    code = ExceptionCode.NOT_FOUND,
  ): AppError {
    return new AppError(message, HttpStatus.NOT_FOUND, code);
  }

  static internal(
    message = 'An unexpected error occurred',
    details?: Record<string, unknown>,
  ): AppError {
    return new AppError(
      message,
      HttpStatus.INTERNAL_SERVER_ERROR,
      ExceptionCode.INTERNAL_ERROR,
      details,
    );
  }
}
