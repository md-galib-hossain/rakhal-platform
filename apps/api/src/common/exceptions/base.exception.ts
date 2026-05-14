import { HttpException, HttpStatus } from '@nestjs/common';
import { ExceptionCode } from './exception-codes.enum';

export interface ExceptionMeta {
  code: ExceptionCode;
  message: string;
  statusCode: HttpStatus;
  details?: Record<string, unknown>;
}

export class BaseException extends HttpException {
  public readonly code: ExceptionCode;
  public readonly details?: Record<string, unknown>;

  constructor(meta: ExceptionMeta) {
    super(meta.message, meta.statusCode);
    this.code = meta.code;
    this.details = meta.details;
  }
}
