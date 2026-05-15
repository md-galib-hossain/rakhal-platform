import { Module } from '@nestjs/common';
import { LoggerModule as PinoModule } from 'nestjs-pino';
import { env } from 'src/core/config/env';
import { SENSITIVE_PATHS } from './logger.constants';
import { LoggerService } from './logger.service';
import { LoggerInterceptor } from './logger.interceptor';
import { LoggerContext } from 'src/core/logger/logger/logger.context';
import { IncomingMessage } from 'http';
import { ServerResponse } from 'http';

interface RequestContextFields {
  requestId?: string;
  traceId?: string;
}

function toLogId(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint') {
    return value.toString();
  }

  return undefined;
}

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

        genReqId: (req) => {
          const request = req as IncomingMessage & RequestContextFields;
          const requestId =
            (request.headers['x-request-id'] as string | undefined) ??
            request.requestId ??
            crypto.randomUUID();

          request.headers['x-request-id'] = requestId;
          request.requestId = requestId;

          return requestId;
        },

        customLogLevel: () => 'info',
        customErrorMessage: (req, res) =>
          `request failed ${req.method ?? 'UNKNOWN'} ${req.url ?? ''} ${res.statusCode}`,

        customErrorObject: (_req, res, error, value) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { err: _err, ...loggableObject } = value as Record<
            string,
            unknown
          >;

          return {
            ...loggableObject,
            httpError: {
              statusCode: res.statusCode,
              message: error.message,
            },
          };
        },

        serializers: {
          req(req: IncomingMessage) {
            const request = req as IncomingMessage & RequestContextFields;

            return {
              id: toLogId(req.id) ?? request.requestId,
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
            if (err && typeof err === 'object') {
              if ('message' in err || 'stack' in err) {
                const typedErr = err as Error & {
                  statusCode?: number;
                  code?: string;
                  details?: Record<string, unknown>;
                };

                return {
                  name: typedErr.name ?? 'Error',
                  message: typedErr.message,
                  stack:
                    env.NODE_ENV !== 'production' ? typedErr.stack : undefined,
                  ...(typedErr.statusCode !== undefined && {
                    statusCode: typedErr.statusCode,
                  }),
                  ...(typedErr.code !== undefined && { code: typedErr.code }),
                  ...(typedErr.details !== undefined && {
                    details: typedErr.details,
                  }),
                };
              }

              return err;
            }

            if (!(err instanceof Error)) {
              return { raw: String(err) };
            }
            const typedErr = err as Error & { code?: string };

            return {
              name: err.name ?? err.constructor?.name,
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
export class LoggerModule {}
