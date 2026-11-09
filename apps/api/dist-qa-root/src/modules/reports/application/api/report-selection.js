"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isFinanceMetric = void 0;
exports.allowedMetricIds = allowedMetricIds;
exports.validateMetricSelection = validateMetricSelection;
exports.scopeIdentity = scopeIdentity;
exports.sameMetricSet = sameMetricSet;
const common_1 = require("@nestjs/common");
const template_1 = require("../../domain/contracts/template");
const reports_api_constants_1 = require("./reports-api.constants");
const isFinanceMetric = (def) => def.requiresPermission === 'finance.read' || def.domain === 'finance';
exports.isFinanceMetric = isFinanceMetric;
function allowedMetricIds(template, registry) {
    const seen = new Set();
    const out = [];
    for (const section of Array.isArray(template.sections)
        ? template.sections
        : []) {
        for (const id of Array.isArray(section.metricIds)
            ? section.metricIds
            : []) {
            if (registry[id] && !seen.has(id)) {
                seen.add(id);
                out.push(id);
            }
        }
    }
    return out;
}
function validateMetricSelection(input) {
    const max = input.max ?? reports_api_constants_1.MAX_SELECTED_METRICS;
    const unique = [...new Set(input.requested.map((id) => id.trim()))].filter((id) => id.length > 0);
    if (unique.length === 0) {
        throw new common_1.BadRequestException({
            message: 'Select at least one metric',
            details: { reason: reports_api_constants_1.ReportApiReason.NO_METRICS },
        });
    }
    if (unique.length > max) {
        throw new common_1.BadRequestException({
            message: `Select at most ${max} metrics`,
            details: { reason: reports_api_constants_1.ReportApiReason.TOO_MANY_METRICS, max },
        });
    }
    if (!input.canFinance) {
        const financeRequested = unique.some((id) => {
            const def = input.registry[id];
            return def ? (0, exports.isFinanceMetric)(def) : id.startsWith('finance.');
        });
        if (financeRequested) {
            throw new common_1.ForbiddenException({
                message: 'Finance metrics require finance access',
                details: { reason: reports_api_constants_1.ReportApiReason.FINANCE_FORBIDDEN },
            });
        }
    }
    if (!(0, template_1.isSubsetOfAllowed)(unique, input.allowed)) {
        throw new common_1.BadRequestException({
            message: 'One or more metrics are not available for this report',
            details: { reason: reports_api_constants_1.ReportApiReason.METRIC_NOT_ALLOWED },
        });
    }
    return unique.sort();
}
function scopeIdentity(scope) {
    switch (scope.kind) {
        case 'SINGLE_COW':
            return `SINGLE_COW:${scope.cattleId}`;
        case 'GROUP':
            return `GROUP:${scope.groupId}`;
        default:
            return 'ALL_ELIGIBLE';
    }
}
function sameMetricSet(a, b) {
    if (a.length !== b.length)
        return false;
    const left = [...a].sort();
    const right = [...b].sort();
    return left.every((id, i) => id === right[i]);
}
//# sourceMappingURL=report-selection.js.map