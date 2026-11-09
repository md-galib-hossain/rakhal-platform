import { MilkQualityTest } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CursorPage } from 'src/common/pagination';
import { CreateMilkQualityTestDto } from '../../presentation/dto/create-milk-quality-test.dto';
import { ListMilkQualityTestQueryDto } from '../../presentation/dto/list-milk-quality-test-query.dto';
export declare class MilkQualityService {
    private readonly prisma;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService);
    create(farmId: string, userId: string, dto: CreateMilkQualityTestDto): Promise<MilkQualityTest>;
    list(farmId: string, query: ListMilkQualityTestQueryDto): Promise<CursorPage<MilkQualityTest>>;
    latestForCattle(farmId: string, cattleId: string): Promise<MilkQualityTest | null>;
    private assertCattleInFarm;
    private assertLactationBelongsToCattle;
}
