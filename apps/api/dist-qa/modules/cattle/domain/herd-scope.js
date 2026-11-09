"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.anyRecord = exports.notDeleted = exports.activeHerd = void 0;
const client_1 = require("@prisma/client");
const activeHerd = (farmId) => ({
    farmId,
    herdStatus: client_1.HerdStatus.ACTIVE,
    deletedAt: null,
});
exports.activeHerd = activeHerd;
const notDeleted = (farmId) => ({
    farmId,
    deletedAt: null,
});
exports.notDeleted = notDeleted;
const anyRecord = (farmId) => ({
    farmId,
});
exports.anyRecord = anyRecord;
//# sourceMappingURL=herd-scope.js.map