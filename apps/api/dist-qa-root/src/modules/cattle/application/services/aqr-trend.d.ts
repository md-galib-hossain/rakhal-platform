import { PrismaService } from 'src/core/database/prisma/prisma.service';
export declare function computeAqrScoreAsOf(prisma: PrismaService, farmId: string, cattle: {
    id: string;
    aqrScore: number | null;
}[], asOf: Date): Promise<Map<string, number | null>>;
