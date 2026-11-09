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
var LegalConsentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegalConsentService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
let LegalConsentService = LegalConsentService_1 = class LegalConsentService {
    prisma;
    log;
    TYPES = [
        client_1.LegalDocumentType.TERMS,
        client_1.LegalDocumentType.PRIVACY,
    ];
    constructor(prisma, logger) {
        this.prisma = prisma;
        this.log = logger.setContext(LegalConsentService_1.name);
    }
    currentDoc(type) {
        return this.prisma.legalDocument.findFirst({
            where: { type, published: true, effectiveAt: { lte: new Date() } },
            orderBy: [{ effectiveAt: 'desc' }, { createdAt: 'desc' }],
        });
    }
    async currentDocuments() {
        const docs = await Promise.all(this.TYPES.map((t) => this.currentDoc(t)));
        return docs.filter((d) => d !== null);
    }
    async getCurrentDocuments() {
        const docs = await this.currentDocuments();
        return docs.map((d) => this.present(d));
    }
    async getConsentStatus(userId) {
        const docs = await this.currentDocuments();
        if (docs.length === 0)
            return { documents: [], all_accepted: true };
        const consents = await this.prisma.consentRecord.findMany({
            where: { userId, documentId: { in: docs.map((d) => d.id) } },
            select: { documentId: true },
        });
        const accepted = new Set(consents.map((c) => c.documentId));
        return {
            documents: docs.map((d) => ({
                id: d.id,
                type: d.type,
                version: d.version,
                title: d.title,
                accepted: accepted.has(d.id),
            })),
            all_accepted: docs.every((d) => accepted.has(d.id)),
        };
    }
    async hasAcceptedCurrent(userId) {
        return (await this.getConsentStatus(userId)).all_accepted;
    }
    async assertConsent(userId) {
        if (!(await this.hasAcceptedCurrent(userId))) {
            throw new common_1.ForbiddenException('You must accept the current Terms of Service and Privacy Policy first');
        }
    }
    async recordConsent(userId, documentIds, ipAddress, farmId) {
        const current = await this.currentDocuments();
        const byId = new Map(current.map((d) => [d.id, d]));
        const toAccept = documentIds.length > 0
            ? documentIds.filter((id) => byId.has(id))
            : current.map((d) => d.id);
        for (const id of toAccept) {
            const doc = byId.get(id);
            await this.prisma.consentRecord.upsert({
                where: { userId_documentId: { userId, documentId: id } },
                create: {
                    userId,
                    farmId: farmId ?? null,
                    documentId: id,
                    documentType: doc.type,
                    version: doc.version,
                    ipAddress: ipAddress ?? null,
                },
                update: {},
            });
        }
        this.log.info('Legal consent recorded', {
            userId,
            documents: toAccept.length,
        });
        return this.getConsentStatus(userId);
    }
    present(d) {
        return {
            id: d.id,
            type: d.type,
            version: d.version,
            title: d.title,
            content: d.content,
            url: d.url,
            effective_at: d.effectiveAt.toISOString(),
        };
    }
};
exports.LegalConsentService = LegalConsentService;
exports.LegalConsentService = LegalConsentService = LegalConsentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService])
], LegalConsentService);
//# sourceMappingURL=legal-consent.service.js.map