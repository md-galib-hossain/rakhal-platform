"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SESSION_CONFIG = exports.ANOMALY_THRESHOLD = void 0;
exports.isAnomaly = isAnomaly;
exports.dropPct = dropPct;
const client_1 = require("@prisma/client");
exports.ANOMALY_THRESHOLD = 0.7;
exports.DEFAULT_SESSION_CONFIG = [
    client_1.MilkSession.MORNING,
    client_1.MilkSession.NOON,
    client_1.MilkSession.EVENING,
];
function isAnomaly(yieldL, avg7d, thresholdFraction = exports.ANOMALY_THRESHOLD) {
    if (avg7d == null || avg7d <= 0)
        return false;
    return yieldL < thresholdFraction * avg7d;
}
function dropPct(yieldL, avg7d) {
    if (avg7d == null || avg7d <= 0)
        return null;
    return Math.max(0, Math.round((1 - yieldL / avg7d) * 100));
}
//# sourceMappingURL=milk-anomaly.js.map