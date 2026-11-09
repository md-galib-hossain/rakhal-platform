"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var InventoryActivityService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryActivityService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const activity_log_service_1 = require("src/modules/activity/application/services/activity-log.service");
let InventoryActivityService = InventoryActivityService_1 = class InventoryActivityService {
    activityLog;
    log;
    constructor(activityLog, logger) {
        this.activityLog = activityLog;
        this.log = logger.setContext(InventoryActivityService_1.name);
    }
    async record(farmId, actorId, eventTitle, actionDetails) {
        try {
            await this.activityLog.record({
                farmId,
                module: client_1.ActivityLogModule.INVENTORY,
                eventTitle,
                actionDetails,
                actorId,
            });
        }
        catch (err) {
            this.log.error('Inventory activity log failed', {
                farmId,
                eventTitle,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
};
exports.InventoryActivityService = InventoryActivityService;
exports.InventoryActivityService = InventoryActivityService = InventoryActivityService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [activity_log_service_1.ActivityLogService,
        logger_service_1.LoggerService])
], InventoryActivityService);
//# sourceMappingURL=inventory-activity.service.js.map