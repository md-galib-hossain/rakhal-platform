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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var NotificationDeliveryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationDeliveryService = void 0;
const common_1 = require("@nestjs/common");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const channel_provider_port_1 = require("../channels/channel-provider.port");
let NotificationDeliveryService = NotificationDeliveryService_1 = class NotificationDeliveryService {
    log;
    byChannel;
    constructor(providers, logger) {
        this.log = logger.setContext(NotificationDeliveryService_1.name);
        this.byChannel = new Map(providers.map((p) => [p.channel, p]));
    }
    async deliver(channel, msg) {
        if (channel === 'in_app')
            return { delivered: true };
        const provider = this.byChannel.get(channel);
        if (!provider || !provider.isConfigured()) {
            this.log.info('Channel deferred (no provider configured)', {
                channel,
                userId: msg.userId,
                eventKey: msg.eventKey,
            });
            return { delivered: false, detail: 'not_configured' };
        }
        const result = await provider.send(msg);
        this.log.info('Channel dispatched', {
            channel,
            userId: msg.userId,
            eventKey: msg.eventKey,
            delivered: result.delivered,
            detail: result.detail,
        });
        return result;
    }
};
exports.NotificationDeliveryService = NotificationDeliveryService;
exports.NotificationDeliveryService = NotificationDeliveryService = NotificationDeliveryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(channel_provider_port_1.CHANNEL_PROVIDERS)),
    __metadata("design:paramtypes", [Array, logger_service_1.LoggerService])
], NotificationDeliveryService);
//# sourceMappingURL=notification-delivery.service.js.map