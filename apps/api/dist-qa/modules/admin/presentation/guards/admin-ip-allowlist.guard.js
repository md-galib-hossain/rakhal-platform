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
var AdminIpAllowlistGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminIpAllowlistGuard = void 0;
const common_1 = require("@nestjs/common");
const env_1 = require("src/core/config/env");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const ip_allowlist_1 = require("../../domain/ip-allowlist");
let AdminIpAllowlistGuard = AdminIpAllowlistGuard_1 = class AdminIpAllowlistGuard {
    log;
    constructor(logger) {
        this.log = logger.setContext(AdminIpAllowlistGuard_1.name);
    }
    canActivate(context) {
        const allowlist = (0, ip_allowlist_1.parseAllowlist)(env_1.env.ADMIN_IP_ALLOWLIST);
        if (allowlist.length === 0)
            return true;
        const request = context.switchToHttp().getRequest();
        if ((0, ip_allowlist_1.isIpAllowed)(request.ip, allowlist))
            return true;
        this.log.warn('Admin request blocked by IP allowlist', {
            ip: request.ip,
            path: request.path,
        });
        throw new common_1.ForbiddenException('Forbidden');
    }
};
exports.AdminIpAllowlistGuard = AdminIpAllowlistGuard;
exports.AdminIpAllowlistGuard = AdminIpAllowlistGuard = AdminIpAllowlistGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [logger_service_1.LoggerService])
], AdminIpAllowlistGuard);
//# sourceMappingURL=admin-ip-allowlist.guard.js.map