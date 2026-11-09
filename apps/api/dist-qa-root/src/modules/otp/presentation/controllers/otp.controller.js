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
exports.OtpController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const client_1 = require("@prisma/client");
const otp_service_1 = require("../../application/services/otp.service");
const verify_otp_dto_1 = require("../dto/verify-otp.dto");
let OtpController = class OtpController {
    otp;
    constructor(otp) {
        this.otp = otp;
    }
    request(userId) {
        return this.otp.request(userId, client_1.OtpPurpose.ACCOUNT_VERIFICATION);
    }
    async verify(userId, dto) {
        await this.otp.verify(userId, client_1.OtpPurpose.ACCOUNT_VERIFICATION, dto.code);
        return { verified: true };
    }
};
exports.OtpController = OtpController;
__decorate([
    (0, common_1.Post)('request'),
    (0, decorators_1.ThrottleAuth)(),
    __param(0, (0, decorators_1.CurrentUserId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], OtpController.prototype, "request", null);
__decorate([
    (0, common_1.Post)('verify'),
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 10 } }),
    __param(0, (0, decorators_1.CurrentUserId)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, verify_otp_dto_1.VerifyOtpDto]),
    __metadata("design:returntype", Promise)
], OtpController.prototype, "verify", null);
exports.OtpController = OtpController = __decorate([
    (0, swagger_1.ApiTags)('Auth — OTP'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('auth/otp'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard),
    __metadata("design:paramtypes", [otp_service_1.OtpService])
], OtpController);
//# sourceMappingURL=otp.controller.js.map