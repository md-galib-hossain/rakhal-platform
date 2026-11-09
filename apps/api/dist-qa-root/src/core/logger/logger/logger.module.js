"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggerModule = void 0;
const common_1 = require("@nestjs/common");
const nestjs_pino_1 = require("nestjs-pino");
const env_1 = require("src/core/config/env");
const logger_constants_1 = require("./logger.constants");
const logger_service_1 = require("./logger.service");
const logger_interceptor_1 = require("./logger.interceptor");
const logger_context_1 = require("src/core/logger/logger/logger.context");
function toLogId(value) {
    if (typeof value === 'string')
        return value;
    if (typeof value === 'number' || typeof value === 'bigint') {
        return value.toString();
    }
    return undefined;
}
let LoggerModule = class LoggerModule {
};
exports.LoggerModule = LoggerModule;
exports.LoggerModule = LoggerModule = __decorate([
    (0, common_1.Module)({
        imports: [
            nestjs_pino_1.LoggerModule.forRoot({
                pinoHttp: {
                    level: env_1.env.LOG_LEVEL ?? 'info',
                    base: {
                        service: env_1.env.APP_NAME,
                        version: env_1.env.APP_VERSION,
                        env: env_1.env.NODE_ENV,
                    },
                    customProps: (req) => ({
                        requestId: req.headers['x-request-id'],
                        traceId: req.headers['x-trace-id'],
                    }),
                    redact: {
                        paths: logger_constants_1.SENSITIVE_PATHS,
                        remove: true,
                    },
                    genReqId: (req) => {
                        const request = req;
                        const requestId = request.headers['x-request-id'] ??
                            request.requestId ??
                            crypto.randomUUID();
                        request.headers['x-request-id'] = requestId;
                        request.requestId = requestId;
                        return requestId;
                    },
                    customLogLevel: () => 'info',
                    customErrorMessage: (req, res) => `request failed ${req.method ?? 'UNKNOWN'} ${req.url ?? ''} ${res.statusCode}`,
                    customErrorObject: (_req, res, error, value) => {
                        const { err: _err, ...loggableObject } = value;
                        return {
                            ...loggableObject,
                            httpError: {
                                statusCode: res.statusCode,
                                message: error.message,
                            },
                        };
                    },
                    serializers: {
                        req(req) {
                            const request = req;
                            return {
                                id: toLogId(req.id) ?? request.requestId,
                                method: req.method,
                                url: req.url,
                                userAgent: req.headers?.['user-agent'],
                                ip: req.socket?.remoteAddress,
                            };
                        },
                        res(res) {
                            return { statusCode: res.statusCode };
                        },
                        err(err) {
                            if (err && typeof err === 'object') {
                                if ('message' in err || 'stack' in err) {
                                    const typedErr = err;
                                    return {
                                        name: typedErr.name ?? 'Error',
                                        message: typedErr.message,
                                        stack: env_1.env.NODE_ENV !== 'production' ? typedErr.stack : undefined,
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
                            const typedErr = err;
                            return {
                                name: err.name ?? err.constructor?.name,
                                message: err.message,
                                stack: env_1.env.NODE_ENV !== 'production' ? err.stack : undefined,
                                code: typedErr.code,
                            };
                        },
                    },
                    autoLogging: {
                        ignore: (req) => ['/health', '/metrics', '/favicon.ico'].includes(req.url ?? ''),
                    },
                    transport: env_1.env.NODE_ENV !== 'production'
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
        providers: [logger_context_1.LoggerContext, logger_service_1.LoggerService, logger_interceptor_1.LoggerInterceptor],
        exports: [logger_context_1.LoggerContext, logger_service_1.LoggerService, logger_interceptor_1.LoggerInterceptor],
    })
], LoggerModule);
//# sourceMappingURL=logger.module.js.map