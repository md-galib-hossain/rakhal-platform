"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizeProtocol = summarizeProtocol;
const IN_PROGRESS_STATUSES = new Set(['DRAFT', 'SCHEDULED', 'IN_PROGRESS']);
function summarizeProtocol(instances) {
    let in_progress = 0;
    let completed = 0;
    let ai_completed = 0;
    let pregnant = 0;
    let open = 0;
    let pregnancy_loss = 0;
    for (const i of instances) {
        if (IN_PROGRESS_STATUSES.has(i.status))
            in_progress += 1;
        if (i.status === 'COMPLETED')
            completed += 1;
        if (i.aiCompletedAt)
            ai_completed += 1;
        if (i.pregnancyOutcome === 'PREGNANT')
            pregnant += 1;
        else if (i.pregnancyOutcome === 'OPEN')
            open += 1;
        else if (i.pregnancyOutcome === 'PREGNANCY_LOSS')
            pregnancy_loss += 1;
    }
    return {
        applied: instances.length,
        in_progress,
        completed,
        ai_completed,
        pregnant,
        open,
        pregnancy_loss,
        conception_rate: completed > 0 ? Math.round((pregnant / completed) * 1000) / 10 : null,
    };
}
//# sourceMappingURL=protocol-metrics.js.map