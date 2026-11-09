import { ExceptionCode } from './exception-codes.enum';
export declare class AppError extends Error {
    readonly statusCode: number;
    readonly code: ExceptionCode;
    readonly details?: Record<string, unknown>;
    constructor(message: string, statusCode?: number, code?: ExceptionCode, details?: Record<string, unknown>);
    static badRequest(message: string, code?: ExceptionCode, details?: Record<string, unknown>): AppError;
    static unauthorized(message?: string, code?: ExceptionCode): AppError;
    static forbidden(message?: string, code?: ExceptionCode): AppError;
    static notFound(message?: string, code?: ExceptionCode): AppError;
    static internal(message?: string, details?: Record<string, unknown>): AppError;
}
