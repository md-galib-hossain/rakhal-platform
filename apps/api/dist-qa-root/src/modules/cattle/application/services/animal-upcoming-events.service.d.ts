import { Prisma } from '@prisma/client';
import { FarmClockService } from 'src/common/farm-time/farm-clock.service';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { AnimalUpcomingEvent, DueFilter } from '../../domain/animal-upcoming-events';
export interface UpcomingEventsOptions {
    windowDays?: number;
    limit?: number;
    now?: Date;
}
export interface AnimalUpcomingEventsResult {
    events: AnimalUpcomingEvent[];
    total: number;
}
export declare class AnimalUpcomingEventsService {
    private readonly prisma;
    private readonly clock;
    constructor(prisma: PrismaService, clock: FarmClockService);
    forCattle(farmId: string, cattleIds: string[], options?: UpcomingEventsOptions): Promise<Map<string, AnimalUpcomingEventsResult>>;
    dueFilterWhere(farmId: string, filter: DueFilter, now?: Date): Promise<Prisma.CattleWhereInput>;
}
