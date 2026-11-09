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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggerService = void 0;
const common_1 = require("@nestjs/common");
const nestjs_pino_1 = require("nestjs-pino");
const logger_context_1 = require("src/core/logger/logger/logger.context");
let LoggerService = class LoggerService {
    pino;
    loggerContext;
    context;
    constructor(pino, loggerContext) {
        this.pino = pino;
        this.loggerContext = loggerContext;
    }
    setContext(context) {
        this.context = context;
        return this;
    }
    mergeContext(meta) {
        const ctx = this.loggerContext?.get();
        return {
            ...(ctx && {
                requestId: ctx.requestId,
                traceId: ctx.traceId,
                userId: ctx.userId,
                farmId: ctx.tenantId,
                tenantId: ctx.tenantId,
                service: 'rakhal-api',
            }),
            ...(ctx === undefined && { service: 'rakhal-api' }),
            context: this.context,
            ...meta,
        };
    }
    serializeError(error) {
        if (error === undefined || error === null)
            return {};
        if (typeof error === 'object' && 'message' in error && 'stack' in error) {
            const e = error;
            return {
                err: {
                    name: e.name ?? 'Error',
                    message: e.message,
                    stack: e.stack,
                    ...(e.statusCode !== undefined && { statusCode: e.statusCode }),
                    ...(e.code !== undefined && { code: e.code }),
                    ...(e.details !== undefined && { details: e.details }),
                },
            };
        }
        try {
            return { err: { raw: JSON.stringify(error) } };
        }
        catch {
            return { err: { raw: this.formatUnknown(error) } };
        }
    }
    formatMessage(message) {
        if (typeof message === 'string')
            return message;
        try {
            return JSON.stringify(message) ?? this.formatUnknown(message);
        }
        catch {
            return this.formatUnknown(message);
        }
    }
    formatUnknown(value) {
        if (typeof value === 'string')
            return value;
        if (typeof value === 'number' ||
            typeof value === 'boolean' ||
            typeof value === 'bigint' ||
            typeof value === 'symbol') {
            return value.toString();
        }
        if (value instanceof Error)
            return value.message;
        return '[Unserializable value]';
    }
    trace(msg, meta) {
        this.pino.trace(this.mergeContext(meta), msg);
    }
    debug(msg, meta) {
        this.pino.debug(this.mergeContext(meta), msg);
    }
    info(msg, meta) {
        this.pino.info(this.mergeContext(meta), msg);
    }
    warn(message, metaOrContext) {
        if (typeof metaOrContext === 'string') {
            this.pino.warn(this.mergeContext({ context: metaOrContext ?? this.context }), this.formatMessage(message));
            return;
        }
        this.pino.warn(this.mergeContext(metaOrContext), this.formatMessage(message));
    }
    error(message, errorOrStack, metaOrContext) {
        if (typeof metaOrContext === 'string') {
            this.pino.error(this.mergeContext({ context: metaOrContext ?? this.context }), this.formatMessage(message));
            return;
        }
        this.pino.error({
            ...this.mergeContext(metaOrContext),
            ...this.serializeError(errorOrStack),
        }, this.formatMessage(message));
    }
    fatal(msg, error, meta) {
        this.pino.fatal({ ...this.mergeContext(meta), ...this.serializeError(error) }, msg);
    }
    audit(action, meta) {
        this.pino.info({ ...this.mergeContext(), audit: true, action, ...meta }, `AUDIT: ${action}`);
    }
    log(msg, context) {
        this.pino.info(this.mergeContext({ context: context ?? this.context }), msg);
    }
    verbose(msg, context) {
        this.pino.trace(this.mergeContext({ context: context ?? this.context }), msg);
    }
};
exports.LoggerService = LoggerService;
exports.LoggerService = LoggerService = __decorate([
    (0, common_1.Injectable)({ scope: common_1.Scope.TRANSIENT }),
    __param(1, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [nestjs_pino_1.PinoLogger,
        logger_context_1.LoggerContext])
], LoggerService);
//# sourceMappingURL=logger.service.js.map