"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AqrConfigService = void 0;
const common_1 = require("@nestjs/common");
const aqr_events_1 = require("../../domain/aqr-events");
let AqrConfigService = class AqrConfigService {
    overrides = new Map();
    async resolveEvent(farmId, eventKey) {
        const farm = await this.overridesFor(farmId);
        return farm.events?.[eventKey] ?? aqr_events_1.AQR_EVENTS[eventKey];
    }
    async resolveBounds(farmId) {
        const farm = await this.overridesFor(farmId);
        return farm.bounds ?? aqr_events_1.AQR_DEFAULT_BOUNDS;
    }
    overridesFor(farmId) {
        return Promise.resolve(this.overrides.get(farmId) ?? {});
    }
};
exports.AqrConfigService = AqrConfigService;
exports.AqrConfigService = AqrConfigService = __decorate([
    (0, common_1.Injectable)()
], AqrConfigService);
//# sourceMappingURL=aqr-config.service.js.map