import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
export interface PublicPlan {
    id: string;
    name: string;
    description: string | null;
    monthly_price: number;
    yearly_price: number | null;
    limits: {
        max_cattle: number | null;
        max_farm_members: number | null;
    };
    features: string[];
}
export declare class PlanCatalogueService {
    private readonly prisma;
    private readonly logger;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService);
    listPlans(): Promise<PublicPlan[]>;
}
