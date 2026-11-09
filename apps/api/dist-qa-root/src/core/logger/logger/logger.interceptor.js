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
exports.LoggerInterceptor = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const logger_service_1 = require("./logger.service");
let LoggerInterceptor = class LoggerInterceptor {
    logger;
    constructor(logger) {
        this.logger = logger;
        this.logger.setContext('HTTP');
    }
    intercept(ctx, next) {
        const req = ctx.switchToHttp().getRequest();
        const res = ctx.switchToHttp().getResponse();
        const start = Date.now();
        this.logger.info('Incoming request', {
            method: req.method,
            path: req.path,
            query: req.query,
        });
        return next.handle().pipe((0, rxjs_1.tap)(() => {
            this.logger.info('Request completed', {
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                durationMs: Date.now() - start,
            });
        }), (0, rxjs_1.catchError)((err) => {
            this.logger.error('Request failed', err, {
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                durationMs: Date.now() - start,
            });
            return (0, rxjs_1.throwError)(() => err);
        }));
    }
};
exports.LoggerInterceptor = LoggerInterceptor;
exports.LoggerInterceptor = LoggerInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [logger_service_1.LoggerService])
], LoggerInterceptor);
//# sourceMappingURL=logger.interceptor.js.map