"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveHealthStatus = deriveHealthStatus;
function deriveHealthStatus(openCases) {
    const sicknessCases = openCases.filter((c) => c.careType === 'CURATIVE');
    if (sicknessCases.some((c) => c.status !== 'ACTIVE')) {
        return 'IN_TREATMENT';
    }
    if (sicknessCases.length > 0) {
        return 'SICK';
    }
    return 'HEALTHY';
}
//# sourceMappingURL=health-status.js.map