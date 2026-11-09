import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
export interface SuccessEnvelope<T = unknown> {
    success: true;
    data: T;
    meta?: unknown;
}
export declare class ResponseEnvelopeInterceptor implements NestInterceptor {
    intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown>;
    private toEnvelope;
    private isAlreadyEnveloped;
    private isBinary;
    private isPaginated;
    private hasDataAndMeta;
}
