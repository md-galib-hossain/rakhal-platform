import { Injectable, NotFoundException } from '@nestjs/common';
import {
  FeedbackStatus,
  MediaCategory,
  MediaUsage,
  SupportFeedback,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { MediaService } from 'src/modules/media/application/services/media.service';
import { CreateFeedbackDto } from '../../presentation/dto/create-feedback.dto';
import { UpdateFeedbackDto } from '../../presentation/dto/update-feedback.dto';

/**
 * Support feedback (RAKHAL-242, PRD §36.7). A farm user submits a categorized
 * message + optional screenshot (processed through the `MediaService`); the Rakhal
 * team triages it from the `admin-api` inbox. Feedback is intentionally *not*
 * farm-scoped on the admin read side — the team sees every farm's tickets.
 */
@Injectable()
export class FeedbackService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(FeedbackService.name);
  }

  /** `POST /feedback` — any farm member. Screenshot is optional. */
  async submit(
    farmId: string,
    userId: string,
    dto: CreateFeedbackDto,
    file?: { buffer: Buffer; originalname?: string; size?: number },
  ) {
    let screenshotAssetId: string | null = null;
    if (file?.buffer?.length) {
      const asset = await this.media.uploadImage({
        farmId,
        uploadedByUserId: userId,
        category: MediaCategory.SUPPORT,
        usage: MediaUsage.FEEDBACK_SCREENSHOT,
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

  /** `GET /admin/feedback` — the triage inbox (newest first, optional status filter). */
  async listForAdmin(status?: FeedbackStatus) {
    const rows = await this.prisma.supportFeedback.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return Promise.all(rows.map((row) => this.presentAdmin(row)));
  }

  /** `PATCH /admin/feedback/:id` — move status + optional internal note. */
  async updateStatus(id: string, adminId: string, dto: UpdateFeedbackDto) {
    const existing = await this.prisma.supportFeedback.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Feedback not found');

    const isResolving =
      dto.status === FeedbackStatus.RESOLVED ||
      dto.status === FeedbackStatus.CLOSED;

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

  private async presentAdmin(fb: SupportFeedback) {
    // Sign the screenshot scoped to the feedback's own farm (the asset belongs
    // to that farm). Best-effort — a missing/deleted asset just yields null.
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
}
