import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LoggerContext } from 'src/core/logger/logger/logger.context';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(private readonly loggerContext: LoggerContext) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const requestId =
      (req.headers['x-request-id'] as string) || crypto.randomUUID();

    const traceId =
      (req.headers['x-trace-id'] as string) || crypto.randomUUID();

    // Propagate IDs back to the client
    res.setHeader('x-request-id', requestId);
    res.setHeader('x-trace-id', traceId);

    this.loggerContext.run({ requestId, traceId }, () => next());
  }
}
