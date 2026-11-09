import { HttpException, HttpStatus } from '@nestjs/common';
import { ExceptionCode } from './exception-codes.enum';
export interface ExceptionMeta {
    code: ExceptionCode;
    message: string;
    statusCode: HttpStatus;
    details?: Record<string, unknown>;
}
export declare class BaseException extends HttpException {
    readonly code: ExceptionCode;
    readonly details?: Record<string, unknown>;
    constructor(meta: ExceptionMeta);
}
