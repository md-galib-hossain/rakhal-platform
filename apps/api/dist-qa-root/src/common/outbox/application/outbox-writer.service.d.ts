import { OutboxEvent, Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { WriteOutboxEventInput } from '../domain/outbox-types';
type Db = PrismaService | Prisma.TransactionClient;
export declare class OutboxWriterService {
    private readonly prisma;
    private readonly queue?;
    constructor(prisma: PrismaService, queue?: Queue | undefined);
    write(input: WriteOutboxEventInput, db?: Db): Promise<OutboxEvent>;
    private nudgeDrain;
}
export {};
