"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseEnvelopeInterceptor = void 0;
const common_1 = require("@nestjs/common");
const operators_1 = require("rxjs/operators");
let ResponseEnvelopeInterceptor = class ResponseEnvelopeInterceptor {
    intercept(_context, next) {
        return next.handle().pipe((0, operators_1.map)((payload) => this.toEnvelope(payload)));
    }
    toEnvelope(payload) {
        if (payload === undefined || payload === null) {
            return payload;
        }
        if (this.isAlreadyEnveloped(payload) || this.isBinary(payload)) {
            return payload;
        }
        if (this.isPaginated(payload)) {
            return {
                success: true,
                data: payload.items,
                meta: payload.meta,
            };
        }
        if (this.hasDataAndMeta(payload)) {
            return {
                success: true,
                data: payload.data,
                meta: payload.meta,
            };
        }
        return { success: true, data: payload };
    }
    isAlreadyEnveloped(value) {
        return (typeof value === 'object' &&
            value !== null &&
            'success' in value &&
            typeof value.success === 'boolean');
    }
    isBinary(value) {
        return (Buffer.isBuffer(value) ||
            (typeof value === 'object' &&
                value !== null &&
                typeof value.pipe === 'function'));
    }
    isPaginated(value) {
        return (typeof value === 'object' &&
            value !== null &&
            'items' in value &&
            'meta' in value);
    }
    hasDataAndMeta(value) {
        return (typeof value === 'object' &&
            value !== null &&
            'data' in value &&
            'meta' in value);
    }
};
exports.ResponseEnvelopeInterceptor = ResponseEnvelopeInterceptor;
exports.ResponseEnvelopeInterceptor = ResponseEnvelopeInterceptor = __decorate([
    (0, common_1.Injectable)()
], ResponseEnvelopeInterceptor);
//# sourceMappingURL=response-envelope.interceptor.js.map