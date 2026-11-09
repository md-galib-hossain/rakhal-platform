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
exports.MetricsInterceptor = void 0;
const common_1 = require("@nestjs/common");
const operators_1 = require("rxjs/operators");
const metrics_service_1 = require("./metrics.service");
let MetricsInterceptor = class MetricsInterceptor {
    metrics;
    constructor(metrics) {
        this.metrics = metrics;
    }
    intercept(context, next) {
        if (context.getType() !== 'http') {
            return next.handle();
        }
        const httpContext = context.switchToHttp();
        const req = httpContext.getRequest();
        const res = httpContext.getResponse();
        const startedAt = process.hrtime.bigint();
        return next.handle().pipe((0, operators_1.tap)({
            next: () => this.record(req, res, startedAt),
            error: () => this.record(req, res, startedAt),
        }));
    }
    record(req, res, startedAt) {
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
            this.metrics.recordHttpError(route, res.statusCode ?? 500, `http_${res.statusCode ?? 500}`);
        }
    }
    resolveRoute(req) {
        const reqWithRoute = req;
        const routePath = reqWithRoute.route?.path;
        if (typeof routePath === 'string' && routePath.length > 0) {
            return routePath;
        }
        const reqPath = req.path;
        return typeof reqPath === 'string' && reqPath.length > 0
            ? reqPath
            : 'unknown';
    }
};
exports.MetricsInterceptor = MetricsInterceptor;
exports.MetricsInterceptor = MetricsInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [metrics_service_1.MetricsService])
], MetricsInterceptor);
//# sourceMappingURL=metrics.interceptor.js.map