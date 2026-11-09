"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_REFERRAL_PROGRAM = void 0;
const client_1 = require("@prisma/client");
exports.DEFAULT_REFERRAL_PROGRAM = {
    rewardAmount: new client_1.Prisma.Decimal(200),
    velocityCapPerWindow: 10,
    velocityWindowHours: 24,
    creditingEnabled: false,
};
//# sourceMappingURL=referral-program.js.map