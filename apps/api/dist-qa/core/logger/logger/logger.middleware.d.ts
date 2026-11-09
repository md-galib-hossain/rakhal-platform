import { NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LoggerContext } from 'src/core/logger/logger/logger.context';
interface RequestWithContext extends Request {
    requestId?: string;
    traceId?: string;
}
export declare class LoggerMiddleware implements NestMiddleware {
    private readonly loggerContext;
    constructor(loggerContext: LoggerContext);
    use(req: RequestWithContext, res: Response, next: NextFunction): void;
}
export {};
