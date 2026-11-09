"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LATE_WINDOW_MS = void 0;
exports.evaluateLate = evaluateLate;
exports.LATE_WINDOW_MS = 2 * 60 * 60 * 1000;
function evaluateLate(fireAt, now) {
    return now.getTime() - fireAt.getTime() > exports.LATE_WINDOW_MS ? 'LATE' : 'FIRE';
}
//# sourceMappingURL=late-rule.js.map