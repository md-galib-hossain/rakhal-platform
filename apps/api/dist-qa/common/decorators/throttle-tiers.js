"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThrottleWrite = exports.ThrottleUpload = exports.ThrottleExpensive = exports.ThrottleAuth = void 0;
const throttler_1 = require("@nestjs/throttler");
const MINUTE_MS = 60_000;
const ThrottleAuth = () => (0, throttler_1.Throttle)({
    default: { ttl: MINUTE_MS, limit: 5, blockDuration: 15 * MINUTE_MS },
});
exports.ThrottleAuth = ThrottleAuth;
const ThrottleExpensive = () => (0, throttler_1.Throttle)({ default: { ttl: MINUTE_MS, limit: 10 } });
exports.ThrottleExpensive = ThrottleExpensive;
const ThrottleUpload = () => (0, throttler_1.Throttle)({ default: { ttl: MINUTE_MS, limit: 15 } });
exports.ThrottleUpload = ThrottleUpload;
const ThrottleWrite = () => (0, throttler_1.Throttle)({ default: { ttl: MINUTE_MS, limit: 60 } });
exports.ThrottleWrite = ThrottleWrite;
//# sourceMappingURL=throttle-tiers.js.map