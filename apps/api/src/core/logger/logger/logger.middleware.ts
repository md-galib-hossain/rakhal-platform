import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LoggerContext } from 'src/core/logger/logger/logger.context';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(private readonly loggerContext: LoggerContext) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // IDs are already set by RequestContextMiddleware — just read them
    const requestId = req.headers['x-request-id'] as string;
    const traceId = req.headers['x-trace-id'] as string;

    // Only responsibility: bind IDs into the async context for the logger
    this.loggerContext.run({ requestId, traceId }, () => next());
  }
}
