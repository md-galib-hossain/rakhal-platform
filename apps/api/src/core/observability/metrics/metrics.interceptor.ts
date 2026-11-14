import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const httpContext = context.switchToHttp() as {
      getRequest<T>(): T;
      getResponse<T>(): T;
    };
    const req = httpContext.getRequest<Request>();
    const res = httpContext.getResponse<{ statusCode: number }>();
    const startedAt = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: () => this.record(req, res, startedAt),
        error: () => this.record(req, res, startedAt),
      }),
    );
  }

  private record(
    req: Request,
    res: { statusCode: number },
    startedAt: bigint,
  ): void {
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const method = req.method ?? 'UNKNOWN';
    const route = this.resolveRoute(req);
    const status = String(res.statusCode ?? 500);

    this.metrics.recordHttpRequest({ method, route, status }, elapsedMs);

    if ((res.statusCode ?? 500) >= 400) {
      const isAuthError = res.statusCode === 401 || res.statusCode === 403;
      if (isAuthError) {
        this.metrics.recordAuthFailure(`http_${res.statusCode}`, route);
      }
      this.metrics.recordHttpError(
        route,
        res.statusCode ?? 500,
        `http_${res.statusCode ?? 500}`,
      );
    }
  }

  private resolveRoute(req: Request): string {
    const reqWithRoute = req as unknown as { route?: { path?: unknown } };
    const routePath = reqWithRoute.route?.path;
    if (typeof routePath === 'string' && routePath.length > 0) {
      return routePath;
    }

    const reqPath = (req as { path?: unknown }).path;
    return typeof reqPath === 'string' && reqPath.length > 0
      ? reqPath
      : 'unknown';
  }
}
