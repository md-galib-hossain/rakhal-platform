import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { FarmSettingsService } from 'src/modules/farm-settings/farm-settings.service';
import { EventRegistry } from '../../domain/event-registry';
import { AnimalFacts, CategoryContext, CattleCategory } from '../../domain/eligibility/categories';
export declare class EligibilityService {
    private readonly prisma;
    private readonly settings;
    private readonly registry;
    constructor(prisma: PrismaService, settings: FarmSettingsService, registry: EventRegistry);
    context(farmId: string, opts?: {
        withFattening?: boolean;
        now?: Date;
    }): Promise<CategoryContext>;
    categoryWhere(farmId: string, category: CattleCategory): Promise<Prisma.CattleWhereInput>;
    fatteningCattleIds(farmId: string): Promise<string[]>;
    loadFacts(farmId: string, cattleId: string, now?: Date): Promise<{
        facts: AnimalFacts;
        ctx: CategoryContext;
        leftHerd: boolean;
    }>;
    eligible(farmId: string, cattleId: string, date?: Date): Promise<{
        categories: ("CALF" | "MALE" | "FEMALE" | "MILKING" | "DRY" | "HEIFER" | "COW" | "PREGNANT" | "OPEN" | "FATTENING" | "ALL" | "WEANED" | "FRESH")[];
        types: import("../../domain/eligibility/evaluate").EligibilityResult[];
    }>;
}
