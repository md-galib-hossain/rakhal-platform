import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { NotificationService } from 'src/modules/notification/application/services/notification.service';
import {
  AdminBroadcastMessageDto,
  AdminSendMessageDto,
} from '../../presentation/dto/admin-communication.dto';
import { AdminAuditService } from './admin-audit.service';

@Injectable()
export class AdminCommunicationsService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly audit: AdminAuditService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(AdminCommunicationsService.name);
  }

  /**
   * Send a direct message to a specific user across their connected channels (e.g. Telegram / Push).
   */
  async sendDirectMessage(
    adminId: string,
    userId: string,
    dto: AdminSendMessageDto,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        farmMembers: {
          select: { farmId: true },
          take: 1,
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const farmId = user.farmMembers[0]?.farmId ?? 'system';

    const result = await this.notificationService.notifyUsers({
      farmId,
      userIds: [userId],
      eventKey: 'admin_broadcast',
      title: dto.title,
      message: dto.message,
      link: dto.link,
    });

    await this.audit.record({
      adminId,
      action: 'COMMUNICATION_SENT',
      entityType: 'User',
      entityId: userId,
      metadata: {
        title: dto.title,
        channel: dto.channel ?? 'all',
        recipientEmail: user.email,
        deliveredCount: result.length,
      },
    });

    this.log.info('Admin direct communication sent', {
      adminId,
      userId,
      title: dto.title,
    });

    return {
      success: true,
      delivered: result.length > 0,
      recipient: { id: user.id, name: user.name, email: user.email },
    };
  }

  /**
   * Broadcast an announcement to multiple users (all, Telegram connected, or owners).
   */
  async broadcast(adminId: string, dto: AdminBroadcastMessageDto) {
    let targetUserIds: string[] = [];

    if (dto.targetUserIds && dto.targetUserIds.length > 0) {
      targetUserIds = dto.targetUserIds;
    } else {
      switch (dto.targetAudience) {
        case 'with_telegram': {
          const deviceTokens = await this.prisma.deviceToken.findMany({
            where: { provider: 'telegram', user: { deletedAt: null } },
            select: { userId: true },
            distinct: ['userId'],
          });
          targetUserIds = deviceTokens.map((d) => d.userId);
          break;
        }
        case 'owners': {
          const owners = await this.prisma.farmMember.findMany({
            where: {
              role: { name: 'Owner' },
              user: { deletedAt: null },
            },
            select: { userId: true },
            distinct: ['userId'],
          });
          targetUserIds = owners.map((o) => o.userId);
          break;
        }
        case 'all':
        default: {
          const users = await this.prisma.user.findMany({
            where: { deletedAt: null, isBlocked: false },
            select: { id: true },
            take: 500,
          });
          targetUserIds = users.map((u) => u.id);
          break;
        }
      }
    }

    if (targetUserIds.length === 0) {
      return { success: true, count: 0, delivered: 0, message: 'No recipients matched the target audience' };
    }

    // Resolve farms for users or fallback to 'system'
    const farmMembers = await this.prisma.farmMember.findMany({
      where: { userId: { in: targetUserIds } },
      select: { userId: true, farmId: true },
    });
    const farmByUser = new Map(farmMembers.map((m) => [m.userId, m.farmId]));

    let totalDelivered = 0;
    // Process in batches of 10 to respect external rate limits
    const BATCH_SIZE = 10;
    for (let i = 0; i < targetUserIds.length; i += BATCH_SIZE) {
      const batch = targetUserIds.slice(i, i + BATCH_SIZE);
      for (const uid of batch) {
        const farmId = farmByUser.get(uid) ?? 'system';
        const res = await this.notificationService.notifyUsers({
          farmId,
          userIds: [uid],
          eventKey: 'admin_broadcast',
          title: dto.title,
          message: dto.message,
          link: dto.link,
        });
        if (res.length > 0) totalDelivered += 1;
      }
      if (i + BATCH_SIZE < targetUserIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    await this.audit.record({
      adminId,
      action: 'COMMUNICATION_SENT',
      entityType: 'Broadcast',
      metadata: {
        title: dto.title,
        targetAudience: dto.targetAudience ?? 'custom',
        targetedCount: targetUserIds.length,
        deliveredCount: totalDelivered,
      },
    });

    this.log.info('Admin broadcast completed', {
      adminId,
      targetedCount: targetUserIds.length,
      totalDelivered,
    });

    return {
      success: true,
      targetedCount: targetUserIds.length,
      deliveredCount: totalDelivered,
    };
  }

  /**
   * Get connected communication channels statistics for admin dashboard.
   */
  async getChannelStats() {
    const [telegramCount, pushCount, totalUsers] = await Promise.all([
      this.prisma.deviceToken.count({ where: { provider: 'telegram' } }),
      this.prisma.deviceToken.count({ where: { provider: 'fcm' } }),
      this.prisma.user.count({ where: { deletedAt: null } }),
    ]);

    return {
      totalUsers,
      telegramSubscribers: telegramCount,
      pushSubscribers: pushCount,
    };
  }
}
