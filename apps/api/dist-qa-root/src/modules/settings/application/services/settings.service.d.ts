import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { UpdateFarmSettingsDto } from '../../presentation/dto/update-farm-settings.dto';
import { CreateShedDto } from '../../presentation/dto/create-shed.dto';
import { UpdateShedDto } from '../../presentation/dto/update-shed.dto';
export declare class SettingsService {
    private readonly prisma;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService);
    getFarm(farmId: string): Promise<{
        timezone: string;
        farm_id: string;
        farm_slug: string;
        farm_name: string;
        description: string | null;
        division: string | null;
        district: string | null;
        upazila: string | null;
        operational_purpose: string | null;
        status: import("@prisma/client").$Enums.FarmStatus;
        phone: string | null;
        address: string | null;
    }>;
    updateFarm(farmId: string, userId: string, dto: UpdateFarmSettingsDto): Promise<{
        timezone: string;
        farm_id: string;
        farm_slug: string;
        farm_name: string;
        description: string | null;
        division: string | null;
        district: string | null;
        upazila: string | null;
        operational_purpose: string | null;
        status: string;
        phone: string | null;
        address: string | null;
    }>;
    listSheds(farmId: string): Promise<{
        id: string;
        name: string;
        code: string;
        description: string | null;
        capacity: number | null;
        purpose: import("@prisma/client").$Enums.ShedPurpose;
        responsible_member: {
            name: string;
            id: string;
        } | null;
        current_count: number;
        deleted_at: Date | null;
        created_at: Date;
    }[]>;
    createShed(farmId: string, dto: CreateShedDto): Promise<{
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        deletedAt: Date | null;
        code: string;
        capacity: number | null;
        purpose: import("@prisma/client").$Enums.ShedPurpose;
        responsibleMemberId: string | null;
    }>;
    updateShed(farmId: string, id: string, dto: UpdateShedDto): Promise<{
        name: string;
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        deletedAt: Date | null;
        code: string;
        capacity: number | null;
        purpose: import("@prisma/client").$Enums.ShedPurpose;
        responsibleMemberId: string | null;
    }>;
    deleteShed(farmId: string, id: string): Promise<{
        id: string;
        deleted_at: Date;
    }>;
    private getShedOrThrow;
    private mapFarm;
    private generateCode;
}
