"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BullmqScheduleQueue = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const bullmq_2 = require("bullmq");
const schedule_queue_port_1 = require("./schedule-queue.port");
const PAGE = 1000;
let BullmqScheduleQueue = class BullmqScheduleQueue {
    queue;
    constructor(queue) {
        this.queue = queue;
    }
    async add(occurrenceId, delayMs) {
        await this.queue.add(schedule_queue_port_1.NOTIFICATION_FIRE_JOB, { occurrenceId }, {
            jobId: occurrenceId,
            delay: Math.max(0, Math.floor(delayMs)),
            attempts: 5,
            backoff: { type: 'exponential', delay: 30_000 },
            removeOnComplete: true,
            removeOnFail: true,
        });
    }
    async remove(occurrenceId) {
        const job = await this.queue.getJob(occurrenceId);
        if (!job)
            return;
        try {
            await job.remove();
        }
        catch {
        }
    }
    async liveJobIds() {
        const ids = [];
        for (let start = 0;; start += PAGE) {
            const jobs = await this.queue.getJobs(['delayed', 'waiting', 'active'], start, start + PAGE - 1);
            for (const j of jobs)
                if (j?.id)
                    ids.push(String(j.id));
            if (jobs.length < PAGE)
                break;
        }
        return [...new Set(ids)];
    }
};
exports.BullmqScheduleQueue = BullmqScheduleQueue;
exports.BullmqScheduleQueue = BullmqScheduleQueue = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)(schedule_queue_port_1.NOTIFICATION_OCCURRENCE_QUEUE)),
    __metadata("design:paramtypes", [bullmq_2.Queue])
], BullmqScheduleQueue);
//# sourceMappingURL=bullmq-schedule-queue.adapter.js.map