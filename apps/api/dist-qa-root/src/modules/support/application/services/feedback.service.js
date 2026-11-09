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
var FeedbackService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedbackService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const media_service_1 = require("src/modules/media/application/services/media.service");
let FeedbackService = FeedbackService_1 = class FeedbackService {
    prisma;
    media;
    log;
    constructor(prisma, media, logger) {
        this.prisma = prisma;
        this.media = media;
        this.log = logger.setContext(FeedbackService_1.name);
    }
    async submit(farmId, userId, dto, file) {
        let screenshotAssetId = null;
        if (file?.buffer?.length) {
            const asset = await this.media.uploadImage({
                farmId,
                uploadedByUserId: userId,
                category: client_1.MediaCategory.SUPPORT,
                usage: client_1.MediaUsage.FEEDBACK_SCREENSHOT,
                file,
            });
            screenshotAssetId = asset.id;
        }
        const feedback = await this.prisma.supportFeedback.create({
            data: {
                farmId,
                userId,
                category: dto.category,
                message: dto.message,
                screenshotAssetId,
            },
        });
        this.log.info('Support feedback submitted', {
            feedbackId: feedback.id,
            farmId,
            category: dto.category,
            hasScreenshot: Boolean(screenshotAssetId),
        });
        return {
            id: feedback.id,
            status: feedback.status,
            created_at: feedback.createdAt.toISOString(),
        };
    }
    async listForAdmin(status) {
        const rows = await this.prisma.supportFeedback.findMany({
            where: status ? { status } : {},
            orderBy: { createdAt: 'desc' },
            take: 200,
        });
        return Promise.all(rows.map((row) => this.presentAdmin(row)));
    }
    async updateStatus(id, adminId, dto) {
        const existing = await this.prisma.supportFeedback.findUnique({
            where: { id },
        });
        if (!existing)
            throw new common_1.NotFoundException('Feedback not found');
        const isResolving = dto.status === client_1.FeedbackStatus.RESOLVED ||
            dto.status === client_1.FeedbackStatus.CLOSED;
        const updated = await this.prisma.supportFeedback.update({
            where: { id },
            data: {
                status: dto.status,
                adminNote: dto.adminNote ?? existing.adminNote,
                resolvedByAdminId: isResolving
                    ? adminId
                    : (existing.resolvedByAdminId ?? null),
                resolvedAt: isResolving ? new Date() : existing.resolvedAt,
            },
        });
        this.log.info('Support feedback triaged', {
            feedbackId: id,
            adminId,
            status: dto.status,
        });
        return this.presentAdmin(updated);
    }
    async presentAdmin(fb) {
        const screenshot = fb.screenshotAssetId
            ? await this.media
                .presentUrls(fb.farmId, fb.screenshotAssetId, true)
                .catch(() => null)
            : null;
        return {
            id: fb.id,
            farm_id: fb.farmId,
            user_id: fb.userId,
            category: fb.category,
            message: fb.message,
            status: fb.status,
            admin_note: fb.adminNote,
            screenshot,
            resolved_by_admin_id: fb.resolvedByAdminId,
            resolved_at: fb.resolvedAt ? fb.resolvedAt.toISOString() : null,
            created_at: fb.createdAt.toISOString(),
        };
    }
};
exports.FeedbackService = FeedbackService;
exports.FeedbackService = FeedbackService = FeedbackService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        media_service_1.MediaService,
        logger_service_1.LoggerService])
], FeedbackService);
//# sourceMappingURL=feedback.service.js.map