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
exports.LoggerMiddleware = void 0;
const common_1 = require("@nestjs/common");
const logger_context_1 = require("src/core/logger/logger/logger.context");
let LoggerMiddleware = class LoggerMiddleware {
    loggerContext;
    constructor(loggerContext) {
        this.loggerContext = loggerContext;
    }
    use(req, res, next) {
        const requestId = req.requestId ?? req.headers['x-request-id'];
        const traceId = req.traceId ?? req.headers['x-trace-id'];
        this.loggerContext.run({ requestId, traceId }, () => next());
    }
};
exports.LoggerMiddleware = LoggerMiddleware;
exports.LoggerMiddleware = LoggerMiddleware = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [logger_context_1.LoggerContext])
], LoggerMiddleware);
//# sourceMappingURL=logger.middleware.js.map