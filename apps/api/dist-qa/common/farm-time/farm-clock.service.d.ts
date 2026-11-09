import { PrismaService } from 'src/core/database/prisma/prisma.service';
export declare class FarmClockService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    timezone(farmId: string): Promise<string>;
    todayIso(farmId: string): Promise<string>;
    todayStart(farmId: string): Promise<Date>;
    dayStart(farmId: string, dateStr?: string | null): Promise<Date>;
}
