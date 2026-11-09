import { AnimalHold, AnimalHoldType } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CursorPage } from 'src/common/pagination';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { CreateAnimalHoldDto } from '../../presentation/dto/create-animal-hold.dto';
import { ListAnimalHoldQueryDto } from '../../presentation/dto/list-animal-hold-query.dto';
import { ReleaseAnimalHoldDto } from '../../presentation/dto/release-animal-hold.dto';
export declare class AnimalHoldService {
    private readonly prisma;
    private readonly activityLog;
    private readonly log;
    constructor(prisma: PrismaService, activityLog: ActivityLogService, logger: LoggerService);
    createHold(farmId: string, userId: string, cattleId: string, dto: CreateAnimalHoldDto): Promise<AnimalHold>;
    releaseAllForCattle(farmId: string, cattleId: string, releasedBy: string): Promise<void>;
    releaseHold(farmId: string, cattleId: string, holdId: string, releasedBy: string, dto?: ReleaseAnimalHoldDto): Promise<AnimalHold>;
    activeHoldsForCattle(farmId: string, cattleId: string, type?: AnimalHoldType): Promise<AnimalHold[]>;
    list(farmId: string, cattleId: string, query: ListAnimalHoldQueryDto): Promise<CursorPage<AnimalHold>>;
    private assertCattleInFarm;
}
