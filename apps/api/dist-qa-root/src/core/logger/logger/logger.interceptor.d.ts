import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { LoggerService } from './logger.service';
export declare class LoggerInterceptor implements NestInterceptor {
    private readonly logger;
    constructor(logger: LoggerService);
    intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown>;
}
