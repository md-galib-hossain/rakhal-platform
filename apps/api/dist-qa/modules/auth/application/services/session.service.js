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
exports.SessionService = void 0;
const common_1 = require("@nestjs/common");
const auth_repository_1 = require("../../infrastructure/persistence/repositories/auth.repository");
let SessionService = class SessionService {
    authRepository;
    constructor(authRepository) {
        this.authRepository = authRepository;
    }
    createSession(data) {
        return this.authRepository.createSession(data);
    }
    listUserSessions(userId) {
        return this.authRepository.getUserSessions(userId);
    }
    findSessionById(sessionId) {
        return this.authRepository.findSessionById(sessionId);
    }
    revokeSessionForUser(sessionId, userId, auditAction) {
        return this.authRepository.revokeSessionForUser({
            sessionId,
            userId,
            auditAction,
        });
    }
    revokeAllSessionsForUser(userId) {
        return this.authRepository.revokeAllSessionsForUser(userId);
    }
};
exports.SessionService = SessionService;
exports.SessionService = SessionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_repository_1.AuthRepository])
], SessionService);
//# sourceMappingURL=session.service.js.map