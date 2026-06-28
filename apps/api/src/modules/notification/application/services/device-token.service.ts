import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { RegisterDeviceDto } from '../../presentation/dto/register-device.dto';

/**
 * Device push-token registry (PRD §20.1). Mobile/web clients register their FCM
 * token here after login so the push channel can target the user's devices; they
 * unregister on logout/uninstall. Tokens are unique — re-registering a token
 * (e.g. it moved to another user/login) re-points it at the current user.
 */
@Injectable()
export class DeviceTokenService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(DeviceTokenService.name);
  }

  async register(userId: string, farmId: string, dto: RegisterDeviceDto) {
    const device = await this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      create: {
        userId,
        farmId,
        token: dto.token,
        platform: dto.platform,
        provider: dto.provider ?? 'fcm',
      },
      update: {
        userId,
        farmId,
        platform: dto.platform,
        provider: dto.provider ?? 'fcm',
        lastSeenAt: new Date(),
      },
      select: { id: true, platform: true, provider: true },
    });
    this.log.info('Device token registered', {
      userId,
      platform: dto.platform,
    });
    return { ...device, registered: true };
  }

  async unregister(userId: string, token: string) {
    const res = await this.prisma.deviceToken.deleteMany({
      where: { token, userId },
    });
    return { removed: res.count > 0 };
  }

  list(userId: string) {
    return this.prisma.deviceToken.findMany({
      where: { userId },
      select: {
        id: true,
        platform: true,
        provider: true,
        createdAt: true,
        lastSeenAt: true,
      },
      orderBy: { lastSeenAt: 'desc' },
    });
  }
}
