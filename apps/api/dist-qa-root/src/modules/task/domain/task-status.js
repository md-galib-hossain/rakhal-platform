"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.displayStatus = displayStatus;
const client_1 = require("@prisma/client");
function displayStatus(status, dueAt, now = new Date()) {
    if (status === client_1.TaskStatus.COMPLETED)
        return 'completed';
    if (status === client_1.TaskStatus.CANCELLED)
        return 'cancelled';
    if (status === client_1.TaskStatus.BLOCKED)
        return 'blocked';
    if (dueAt.getTime() < now.getTime())
        return 'overdue';
    return status === client_1.TaskStatus.IN_PROGRESS ? 'in_progress' : 'pending';
}
//# sourceMappingURL=task-status.js.map