import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { RegisterDeviceDto } from '../../presentation/dto/register-device.dto';
export declare class DeviceTokenService {
    private readonly prisma;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService);
    register(userId: string, farmId: string, dto: RegisterDeviceDto): Promise<{
        registered: boolean;
        provider: string;
        id: string;
        platform: string;
    }>;
    unregister(userId: string, token: string): Promise<{
        removed: boolean;
    }>;
    list(userId: string): import("@prisma/client").Prisma.PrismaPromise<{
        provider: string;
        id: string;
        createdAt: Date;
        platform: string;
        lastSeenAt: Date;
    }[]>;
}
