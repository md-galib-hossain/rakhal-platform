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
exports.AdminTwoFactorSetupGuard = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const admin_token_service_1 = require("../../application/services/admin-token.service");
let AdminTwoFactorSetupGuard = class AdminTwoFactorSetupGuard {
    tokens;
    prisma;
    constructor(tokens, prisma) {
        this.tokens = tokens;
        this.prisma = prisma;
    }
    async canActivate(context) {
        const request = context
            .switchToHttp()
            .getRequest();
        const header = request.headers.authorization;
        if (!header?.startsWith('Bearer ')) {
            throw new common_1.UnauthorizedException('2FA setup token required');
        }
        const token = header.slice('Bearer '.length);
        let payload;
        try {
            payload = await this.tokens.verify(token);
        }
        catch {
            throw new common_1.UnauthorizedException('2FA setup token required');
        }
        if (payload.type !== 'platform_admin_2fa_setup') {
            throw new common_1.UnauthorizedException('2FA setup token required');
        }
        const admin = await this.prisma.platformAdmin.findUnique({
            where: { id: payload.sub },
        });
        if (!admin || !admin.isActive) {
            throw new common_1.UnauthorizedException('2FA setup token required');
        }
        request.admin = { id: admin.id, email: admin.email, role: admin.role };
        return true;
    }
};
exports.AdminTwoFactorSetupGuard = AdminTwoFactorSetupGuard;
exports.AdminTwoFactorSetupGuard = AdminTwoFactorSetupGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [admin_token_service_1.AdminTokenService,
        prisma_service_1.PrismaService])
], AdminTwoFactorSetupGuard);
//# sourceMappingURL=admin-two-factor-setup.guard.js.map