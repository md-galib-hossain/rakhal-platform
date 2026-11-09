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
exports.LegalController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("src/common/decorators");
const jwt_auth_guard_1 = require("src/modules/auth/presentation/guards/jwt-auth.guard");
const session_guard_1 = require("src/modules/auth/presentation/guards/session.guard");
const legal_consent_service_1 = require("../../application/services/legal-consent.service");
const record_consent_dto_1 = require("../dto/record-consent.dto");
let LegalController = class LegalController {
    legal;
    constructor(legal) {
        this.legal = legal;
    }
    documents() {
        return this.legal.getCurrentDocuments();
    }
    status(userId) {
        return this.legal.getConsentStatus(userId);
    }
    accept(userId, dto, req) {
        return this.legal.recordConsent(userId, dto.documentIds ?? [], req.ip);
    }
};
exports.LegalController = LegalController;
__decorate([
    (0, common_1.Get)('documents'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LegalController.prototype, "documents", null);
__decorate([
    (0, common_1.Get)('consent'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard),
    __param(0, (0, decorators_1.CurrentUserId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LegalController.prototype, "status", null);
__decorate([
    (0, common_1.Post)('consent'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, session_guard_1.SessionGuard),
    __param(0, (0, decorators_1.CurrentUserId)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, record_consent_dto_1.RecordConsentDto, Object]),
    __metadata("design:returntype", void 0)
], LegalController.prototype, "accept", null);
exports.LegalController = LegalController = __decorate([
    (0, swagger_1.ApiTags)('Legal'),
    (0, common_1.Controller)('legal'),
    __metadata("design:paramtypes", [legal_consent_service_1.LegalConsentService])
], LegalController);
//# sourceMappingURL=legal.controller.js.map