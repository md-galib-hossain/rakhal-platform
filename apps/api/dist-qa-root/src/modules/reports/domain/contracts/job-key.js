"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FARM_ID_PATTERN = void 0;
exports.scheduledReportKey = scheduledReportKey;
exports.FARM_ID_PATTERN = /^c[a-z0-9]{24}$/;
function scheduledReportKey(input) {
    const { farmId, type, periodStartDate, templateVersion } = input;
    if (!exports.FARM_ID_PATTERN.test(farmId ?? '')) {
        throw new Error('farmId must be a cuid (no whitespace or ":")');
    }
    if (type !== 'WEEKLY' && type !== 'MONTHLY')
        throw new Error(`Not a scheduled type: ${String(type)}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStartDate)) {
        throw new Error('periodStartDate must be YYYY-MM-DD');
    }
    if (!Number.isInteger(templateVersion) || templateVersion < 1) {
        throw new Error('templateVersion must be a positive integer');
    }
    return `${farmId}:${type}:${periodStartDate}:v${templateVersion}`;
}
//# sourceMappingURL=job-key.js.map