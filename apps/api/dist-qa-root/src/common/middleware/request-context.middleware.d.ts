import { NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
interface RequestWithContext extends Request {
    requestId?: string;
    traceId?: string;
}
export declare class RequestContextMiddleware implements NestMiddleware {
    use(req: RequestWithContext, res: Response, next: NextFunction): void;
}
export {};
