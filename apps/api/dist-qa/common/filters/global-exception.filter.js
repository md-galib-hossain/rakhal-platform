"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const logger_service_1 = require("../../core/logger/logger/logger.service");
const base_exception_1 = require("../exceptions/base.exception");
const exception_codes_enum_1 = require("../exceptions/exception-codes.enum");
const app_error_1 = require("src/common/exceptions/app.error");
const env_1 = require("src/core/config/env");
const sentry_service_1 = require("src/core/observability/sentry/sentry.service");
const i18n_service_1 = require("src/common/i18n/i18n.service");
const language_1 = require("src/common/i18n/language");
const COMMON_MESSAGE_KEYS = {
    Unauthorized: 'common.unauthorized',
    'Session is not active': 'common.sessionNotActive',
    'Session permissions are stale': 'common.sessionPermissionsStale',
    'Invalid credentials': 'common.invalidCredentials',
    'Forbidden resource': 'common.forbiddenResource',
    'ThrottlerException: Too many requests': 'common.rateLimited',
};
const HTTP_EXCEPTION_CODE_BY_STATUS = {
    [common_1.HttpStatus.BAD_REQUEST]: exception_codes_enum_1.ExceptionCode.VALIDATION_ERROR,
    [common_1.HttpStatus.UNAUTHORIZED]: exception_codes_enum_1.ExceptionCode.UNAUTHORIZED,
    [common_1.HttpStatus.FORBIDDEN]: exception_codes_enum_1.ExceptionCode.FORBIDDEN,
    [common_1.HttpStatus.NOT_FOUND]: exception_codes_enum_1.ExceptionCode.NOT_FOUND,
    [common_1.HttpStatus.CONFLICT]: exception_codes_enum_1.ExceptionCode.CONFLICT,
    [common_1.HttpStatus.TOO_MANY_REQUESTS]: exception_codes_enum_1.ExceptionCode.RATE_LIMITED,
};
let GlobalExceptionFilter = class GlobalExceptionFilter {
    logger;
    sentry;
    i18n;
    constructor(logger, sentry, i18n) {
        this.logger = logger;
        this.sentry = sentry;
        this.i18n = i18n;
    }
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const request = ctx.getRequest();
        const response = ctx.getResponse();
        const requestId = request.requestId ?? 'unknown';
        const traceId = request.traceId ?? 'unknown';
        const lang = (0, language_1.resolveLanguage)(request.headers['accept-language']);
        const { statusCode, code, message, details } = this.resolveException(exception, lang);
        const timestamp = new Date().toISOString();
        const errorResponse = {
            success: false,
            message,
            code,
            requestId,
            timestamp,
            ...(statusCode < 500 && details ? { details } : {}),
        };
        if (statusCode >= 500) {
            this.sentry.captureException(exception, {
                requestId,
                traceId,
                route: request.url,
                method: request.method,
                userId: request.user?.['sub'] ?? 'anonymous',
            });
            this.logger.error('Unhandled exception', exception, {
                requestId,
                traceId,
                path: request.url,
                method: request.method,
                statusCode,
                code,
                errorTimestamp: timestamp,
                details,
            });
        }
        else {
            this.logger.warn('Client error', {
                code,
                message,
                statusCode,
                path: request.url,
                requestId,
                traceId,
                errorTimestamp: timestamp,
            });
        }
        response.status(statusCode).json(errorResponse);
    }
    resolveException(exception, lang) {
        if (exception instanceof base_exception_1.BaseException) {
            const statusCode = exception.getStatus();
            return {
                statusCode,
                code: exception.code,
                message: this.getResponseMessage(statusCode, exception.message, lang),
                details: exception.details,
            };
        }
        if (exception instanceof app_error_1.AppError) {
            return {
                statusCode: exception.statusCode,
                code: exception.code,
                message: this.getResponseMessage(exception.statusCode, exception.message, lang),
                details: exception.details,
            };
        }
        if (exception instanceof common_1.HttpException) {
            const exceptionResponse = exception.getResponse();
            const httpBody = typeof exceptionResponse === 'object' && exceptionResponse !== null
                ? exceptionResponse
                : { message: exception.message };
            const rawMessage = httpBody.message ?? exception.message;
            const message = Array.isArray(rawMessage)
                ? rawMessage.join(', ')
                : rawMessage;
            return {
                statusCode: exception.getStatus(),
                code: this.resolveHttpExceptionCode(exception, httpBody),
                message: this.getResponseMessage(exception.getStatus(), message, lang),
                details: typeof httpBody.details === 'object' &&
                    httpBody.details !== null &&
                    !Array.isArray(httpBody.details)
                    ? httpBody.details
                    : undefined,
            };
        }
        if (exception instanceof Error) {
            return {
                statusCode: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
                code: exception_codes_enum_1.ExceptionCode.INTERNAL_ERROR,
                message: this.i18n.translate(lang, 'common.internalError'),
                details: env_1.env.NODE_ENV === 'production'
                    ? undefined
                    : { stack: exception.stack },
            };
        }
        return {
            statusCode: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
            code: exception_codes_enum_1.ExceptionCode.INTERNAL_ERROR,
            message: this.i18n.translate(lang, 'common.internalError'),
        };
    }
    getResponseMessage(statusCode, message, lang) {
        if (statusCode >= 500 && env_1.env.NODE_ENV === 'production') {
            return this.i18n.translate(lang, 'common.internalError');
        }
        const key = COMMON_MESSAGE_KEYS[message];
        return key ? this.i18n.translate(lang, key) : message;
    }
    resolveHttpExceptionCode(exception, response) {
        if (this.isExceptionCode(response.code))
            return response.code;
        return (HTTP_EXCEPTION_CODE_BY_STATUS[exception.getStatus()] ??
            exception_codes_enum_1.ExceptionCode.INTERNAL_ERROR);
    }
    isExceptionCode(value) {
        return (typeof value === 'string' &&
            Object.values(exception_codes_enum_1.ExceptionCode).includes(value));
    }
};
exports.GlobalExceptionFilter = GlobalExceptionFilter;
exports.GlobalExceptionFilter = GlobalExceptionFilter = __decorate([
    (0, common_1.Injectable)(),
    (0, common_1.Catch)(),
    __metadata("design:paramtypes", [logger_service_1.LoggerService,
        sentry_service_1.SentryService,
        i18n_service_1.I18nService])
], GlobalExceptionFilter);
//# sourceMappingURL=global-exception.filter.js.map