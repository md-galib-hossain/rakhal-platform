import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LoggerContext } from 'src/core/logger/logger/logger.context';

interface RequestWithContext extends Request {
  requestId?: string;
  traceId?: string;
}

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(private readonly loggerContext: LoggerContext) {}

  use(req: RequestWithContext, res: Response, next: NextFunction): void {
    // IDs are already set by RequestContextMiddleware — just read them
    const requestId = req.requestId ?? (req.headers['x-request-id'] as string);
    const traceId = req.traceId ?? (req.headers['x-trace-id'] as string);

    // Only responsibility: bind IDs into the async context for the logger
    this.loggerContext.run({ requestId, traceId }, () => next());
  }
}
