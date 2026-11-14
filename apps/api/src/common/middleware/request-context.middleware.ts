import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

interface RequestWithContext extends Request {
  requestId?: string;
  traceId?: string;
}

function toRequestId(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint') {
    return value.toString();
  }

  return undefined;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: RequestWithContext, res: Response, next: NextFunction): void {
    const requestId =
      (req.headers['x-request-id'] as string | undefined) ??
      toRequestId(req.id) ??
      crypto.randomUUID();
    const traceId =
      (req.headers['x-trace-id'] as string | undefined) ??
      req.traceId ??
      crypto.randomUUID();

    // Set on headers so LoggerMiddleware can read them downstream
    req.headers['x-request-id'] = requestId;
    req.headers['x-trace-id'] = traceId;
    req.id = requestId;
    req.requestId = requestId;
    req.traceId = traceId;

    // Propagate back to client
    res.setHeader('x-request-id', requestId);
    res.setHeader('x-trace-id', traceId);

    next();
  }
}
