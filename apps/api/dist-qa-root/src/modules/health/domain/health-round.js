"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDueState = exports.treatmentRoundKey = exports.applicationRoundKey = void 0;
exports.parseRoundKey = parseRoundKey;
exports.cellState = cellState;
exports.summarizeRound = summarizeRound;
exports.buildRoundGrid = buildRoundGrid;
const health_reminder_cadence_1 = require("./health-reminder-cadence");
const applicationRoundKey = (applicationId) => `app:${applicationId}`;
exports.applicationRoundKey = applicationRoundKey;
const treatmentRoundKey = (planId, day) => `trt:${planId}:${day}`;
exports.treatmentRoundKey = treatmentRoundKey;
const APP_KEY = /^app:([^:]+)$/;
const TRT_KEY = /^trt:([^:]+):(\d{4}-\d{2}-\d{2})$/;
function parseRoundKey(key) {
    const app = APP_KEY.exec(key);
    if (app)
        return { type: 'APPLICATION', applicationId: app[1] };
    const trt = TRT_KEY.exec(key);
    if (trt)
        return { type: 'TREATMENT', planId: trt[1], day: trt[2] };
    return null;
}
const OPEN_STATUSES = new Set(['PENDING', 'RESCHEDULED', 'OVERDUE']);
function cellState(task, timezone, now) {
    const days = (0, health_reminder_cadence_1.farmDaysUntil)(task.dueDateTime, timezone, now);
    if (task.status === 'COMPLETED')
        return { state: 'done', days };
    if (task.status === 'SKIPPED')
        return { state: 'skipped', days };
    if (!OPEN_STATUSES.has(task.status) || !task.live) {
        return { state: 'inactive', days };
    }
    if (days < 0 || task.status === 'OVERDUE')
        return { state: 'overdue', days: Math.min(days, -1) };
    return { state: days === 0 ? 'today' : 'upcoming', days };
}
const isDueState = (state) => state === 'overdue' || state === 'today';
exports.isDueState = isDueState;
function summarizeRound(tasks, timezone, now, dayOf) {
    let stepsDone = 0;
    let stepsSkipped = 0;
    let stepsOverdue = 0;
    let stepsDueToday = 0;
    let next = null;
    let running = false;
    for (const task of tasks) {
        if (task.status === 'SKIPPED') {
            stepsSkipped += 1;
            continue;
        }
        if (task.status === 'COMPLETED')
            stepsDone += 1;
        const { state } = cellState(task, timezone, now);
        if (state === 'overdue')
            stepsOverdue += 1;
        if (state === 'today')
            stepsDueToday += 1;
        if (OPEN_STATUSES.has(task.status) && task.live) {
            running = true;
            if (!next || task.dueDateTime < next)
                next = task.dueDateTime;
        }
    }
    return {
        stepsTotal: tasks.length - stepsSkipped,
        stepsDone,
        stepsSkipped,
        stepsOverdue,
        stepsDueToday,
        nextDueDate: next ? dayOf(next) : null,
        status: running ? 'RUNNING' : 'FINISHED',
    };
}
function buildRoundGrid(runs, tasks, steps, timezone, now) {
    const ordered = [...steps].sort((a, b) => a.dayNumber - b.dayNumber);
    const columns = ordered.map((step, i) => ({
        key: `s${i + 1}`,
        stepNumber: i + 1,
        dayNumber: step.dayNumber,
        title: step.title,
    }));
    const columnOf = (task) => {
        if (task.stepNumber != null &&
            task.stepNumber >= 1 &&
            task.stepNumber <= ordered.length) {
            return `s${task.stepNumber}`;
        }
        const key = `x:${task.title}`;
        if (!columns.some((c) => c.key === key)) {
            columns.push({
                key,
                stepNumber: null,
                dayNumber: null,
                title: task.title,
            });
        }
        return key;
    };
    const rows = new Map(runs.map((run) => [
        run.runKey,
        { ...run, cells: {}, dueCount: 0, overdueCount: 0 },
    ]));
    for (const task of tasks) {
        const row = rows.get(task.runKey);
        if (!row)
            continue;
        const { state, days } = cellState(task, timezone, now);
        row.cells[columnOf(task)] = {
            taskId: task.id,
            state,
            days,
            title: task.title,
            status: task.status,
            stepNumber: task.stepNumber,
            dueDate: task.dueDateTime,
            doneAt: task.completedAt,
        };
        if ((0, exports.isDueState)(state))
            row.dueCount += 1;
        if (state === 'overdue')
            row.overdueCount += 1;
    }
    const label = (row) => row.cattle.name ?? row.cattle.tagNumber;
    return {
        columns,
        rows: [...rows.values()].sort((a, b) => b.overdueCount - a.overdueCount ||
            b.dueCount - a.dueCount ||
            label(a).localeCompare(label(b)) ||
            a.runKey.localeCompare(b.runKey)),
    };
}
//# sourceMappingURL=health-round.js.map