import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { LoggerModule as PinoModule } from 'nestjs-pino';
import { env } from 'src/core/config/env';
import { SENSITIVE_PATHS } from './logger.constants';
import { LoggerService } from './logger.service';
import { LoggerMiddleware } from './logger.middleware';
import { LoggerInterceptor } from './logger.interceptor';
import { LoggerContext } from 'src/core/logger/logger/logger.context';
import { IncomingMessage } from 'http';
import { ServerResponse } from 'http';

@Module({
  imports: [
    PinoModule.forRoot({
      pinoHttp: {
        level: env.LOG_LEVEL ?? 'info',

        base: {
          service: env.APP_NAME,
          version: env.APP_VERSION, // add to your env schema
          env: env.NODE_ENV,
        },

        // Stamp every log with the request/trace IDs from the context
        customProps: (req) => ({
          requestId: req.headers['x-request-id'],
          traceId: req.headers['x-trace-id'],
        }),

        redact: {
          paths: SENSITIVE_PATHS,
          remove: true,
        },

        genReqId: (req) =>
          (req.headers['x-request-id'] as string) || crypto.randomUUID(),

        serializers: {
          req(req: IncomingMessage) {
            return {
              id: req.id,
              method: req.method,
              url: req.url,
              userAgent: req.headers?.['user-agent'],
              ip: req.socket?.remoteAddress,
            };
          },
          res(res: ServerResponse) {
            return { statusCode: res.statusCode };
          },
          // Ensure error stacks are always serialized
          err(err: unknown) {
            if (!(err instanceof Error)) {
              return { raw: String(err) };
            }
            const typedErr = err as Error & { code?: string };

            return {
              type: err.constructor?.name,
              message: err.message,
              stack: env.NODE_ENV !== 'production' ? err.stack : undefined,
              code: typedErr.code,
            };
          },
        },

        // Skip health-check noise
        autoLogging: {
          ignore: (req) =>
            ['/health', '/metrics', '/favicon.ico'].includes(req.url ?? ''),
        },

        transport:
          env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  singleLine: true,
                  ignore: 'pid,hostname',
                  translateTime: 'SYS:HH:MM:ss.l',
                },
              }
            : undefined,
      },
    }),
  ],
  providers: [LoggerContext, LoggerService, LoggerInterceptor],
  exports: [LoggerContext, LoggerService, LoggerInterceptor],
})
export class LoggerModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
