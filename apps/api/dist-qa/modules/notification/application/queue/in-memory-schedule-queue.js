"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryScheduleQueue = void 0;
class InMemoryScheduleQueue {
    clock;
    jobs = new Map();
    constructor(clock = () => new Date()) {
        this.clock = clock;
    }
    add(occurrenceId, delayMs) {
        if (!this.jobs.has(occurrenceId)) {
            this.jobs.set(occurrenceId, {
                runAt: this.clock().getTime() + delayMs,
            });
        }
        return Promise.resolve();
    }
    remove(occurrenceId) {
        this.jobs.delete(occurrenceId);
        return Promise.resolve();
    }
    liveJobIds() {
        return Promise.resolve([...this.jobs.keys()]);
    }
    has(occurrenceId) {
        return this.jobs.has(occurrenceId);
    }
    get size() {
        return this.jobs.size;
    }
    flush() {
        this.jobs.clear();
    }
    dueIds(now) {
        return [...this.jobs.entries()]
            .filter(([, j]) => j.runAt <= now.getTime())
            .sort((a, b) => a[1].runAt - b[1].runAt)
            .map(([id]) => id);
    }
    async runDue(now, handler) {
        const ids = this.dueIds(now);
        for (const id of ids) {
            this.jobs.delete(id);
            await handler(id);
        }
        return ids;
    }
}
exports.InMemoryScheduleQueue = InMemoryScheduleQueue;
//# sourceMappingURL=in-memory-schedule-queue.js.map