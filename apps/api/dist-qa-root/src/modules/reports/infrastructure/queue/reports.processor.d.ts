import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ReportGenerationService } from '../../application/pipeline/report-generation.service';
import type { ReportJobData } from './report-queue.service';
export declare class ReportsProcessor extends WorkerHost {
    private readonly generation;
    constructor(generation: ReportGenerationService);
    process(job: Job<ReportJobData>, token?: string): Promise<void>;
}
