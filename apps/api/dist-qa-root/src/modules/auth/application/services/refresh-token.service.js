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
exports.RefreshTokenService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const auth_repository_1 = require("../../infrastructure/persistence/repositories/auth.repository");
let RefreshTokenService = class RefreshTokenService {
    authRepository;
    constructor(authRepository) {
        this.authRepository = authRepository;
    }
    hashToken(rawToken) {
        return (0, crypto_1.createHash)('sha256').update(rawToken).digest('hex');
    }
    generateToken() {
        return (0, crypto_1.randomBytes)(48).toString('hex');
    }
    async storeRefreshToken(data) {
        const tokenFamily = data.tokenFamily ?? (0, crypto_1.randomUUID)();
        return this.authRepository.createRefreshToken({
            sessionId: data.sessionId,
            tokenHash: this.hashToken(data.rawToken),
            tokenFamily,
            parentTokenId: data.parentTokenId,
            expiresAt: data.expiresAt,
        });
    }
    findByRawToken(rawToken) {
        return this.authRepository.findRefreshTokenByHash(this.hashToken(rawToken));
    }
    revokeToken(tokenId) {
        return this.authRepository.revokeRefreshToken(tokenId);
    }
    completeRotation(data) {
        return this.authRepository.completeRefreshRotation({
            ...data,
            refreshReason: 'rotated',
        });
    }
    markReuse(data) {
        return this.authRepository.markRefreshReuse({
            ...data,
            reason: 'rotated-or-reused-token',
        });
    }
};
exports.RefreshTokenService = RefreshTokenService;
exports.RefreshTokenService = RefreshTokenService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_repository_1.AuthRepository])
], RefreshTokenService);
//# sourceMappingURL=refresh-token.service.js.map