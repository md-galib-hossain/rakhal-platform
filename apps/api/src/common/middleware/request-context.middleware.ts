import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId =
      (req.headers['x-request-id'] as string) || crypto.randomUUID();
    const traceId =
      (req.headers['x-trace-id'] as string) || crypto.randomUUID();

    // Set on headers so LoggerMiddleware can read them downstream
    req.headers['x-request-id'] = requestId;
    req.headers['x-trace-id'] = traceId;

    // Propagate back to client
    res.setHeader('x-request-id', requestId);
    res.setHeader('x-trace-id', traceId);

    next();
  }
}
