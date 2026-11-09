"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OUTBOX_DRAIN_INTERVAL_MS = exports.OUTBOX_NUDGE_DELAY_MS = exports.OUTBOX_NUDGE_JOB = exports.OUTBOX_DRAIN_JOB = exports.OUTBOX_QUEUE = void 0;
exports.OUTBOX_QUEUE = 'outbox-queue';
exports.OUTBOX_DRAIN_JOB = 'drain-outbox';
exports.OUTBOX_NUDGE_JOB = 'drain-outbox-nudge';
exports.OUTBOX_NUDGE_DELAY_MS = 2_000;
exports.OUTBOX_DRAIN_INTERVAL_MS = Number(process.env.OUTBOX_DRAIN_INTERVAL_MS) || 15 * 60_000;
//# sourceMappingURL=outbox.queue.constants.js.map