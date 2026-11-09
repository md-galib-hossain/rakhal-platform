"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REPORT_ERROR_CATEGORIES = exports.PERMANENT_ERROR_CATEGORIES = exports.TRANSIENT_ERROR_CATEGORIES = exports.DATE_PRESETS = exports.REPORT_SCOPE_KINDS = exports.REPORT_DOMAINS = exports.isTerminalStatus = exports.REPORT_TERMINAL_STATUSES = exports.REPORT_STATUSES = exports.REPORT_ORIGINS = exports.REPORT_TYPES = void 0;
exports.isTransientError = isTransientError;
exports.REPORT_TYPES = ['WEEKLY', 'MONTHLY', 'ON_DEMAND'];
exports.REPORT_ORIGINS = ['SCHEDULED', 'ON_DEMAND'];
exports.REPORT_STATUSES = [
    'QUEUED',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
];
exports.REPORT_TERMINAL_STATUSES = [
    'COMPLETED',
    'FAILED',
];
const isTerminalStatus = (s) => exports.REPORT_TERMINAL_STATUSES.includes(s);
exports.isTerminalStatus = isTerminalStatus;
exports.REPORT_DOMAINS = [
    'milk',
    'health',
    'reproduction',
    'finance',
    'feed',
    'cow_profile',
];
exports.REPORT_SCOPE_KINDS = [
    'SINGLE_COW',
    'GROUP',
    'ALL_ELIGIBLE',
];
exports.DATE_PRESETS = [
    'today',
    'this_week',
    'this_month',
    'this_year',
    'custom',
];
exports.TRANSIENT_ERROR_CATEGORIES = [
    'STORAGE_UNAVAILABLE',
    'DB_TIMEOUT',
    'QUEUE_UNAVAILABLE',
];
exports.PERMANENT_ERROR_CATEGORIES = [
    'INVALID_CONFIG',
    'PLAN_LIMIT',
    'PERMISSION_DENIED',
    'RENDER_FAILED',
    'GENERATION_FAILED',
];
exports.REPORT_ERROR_CATEGORIES = [
    ...exports.TRANSIENT_ERROR_CATEGORIES,
    ...exports.PERMANENT_ERROR_CATEGORIES,
];
function isTransientError(category) {
    return exports.TRANSIENT_ERROR_CATEGORIES.includes(category);
}
//# sourceMappingURL=enums.js.map