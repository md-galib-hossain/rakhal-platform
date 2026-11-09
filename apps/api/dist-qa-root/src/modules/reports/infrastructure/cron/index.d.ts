import type { DynamicModule, Provider, Type } from '@nestjs/common';
export * from './report-job-lock';
export * from './report-scheduler.cron';
export declare const REPORT_SCHEDULER_IMPORTS: Array<DynamicModule | Type<unknown>>;
export declare const REPORT_SCHEDULER_PROVIDERS: Provider[];
