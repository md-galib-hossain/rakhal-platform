import { FarmService } from '../../application/services/farm.service';
import { CreateFarmDto } from '../dto/create-farm.dto';
export declare class FarmController {
    private readonly farmService;
    constructor(farmService: FarmService);
    create(userId: string, dto: CreateFarmDto): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        deletedAt: Date | null;
        slug: string;
        logo: string | null;
        status: import("@prisma/client").$Enums.FarmStatus;
        division: string | null;
        district: string | null;
        upazila: string | null;
        operationalPurpose: string | null;
        phone: string | null;
        address: string | null;
        herdSizeBand: string | null;
        cattleIdPrefix: string | null;
        farmCode: string | null;
        freePlanActivatedAt: Date | null;
        hasCompletedOnboarding: boolean;
        timezone: string;
        ownerId: string;
    }>;
    listMine(userId: string): Promise<{
        role: string;
        name: string;
        id: string;
        slug: string;
        status: import("@prisma/client").$Enums.FarmStatus;
    }[]>;
    softDelete(farmId: string, userId: string): Promise<{
        success: true;
    }>;
}
