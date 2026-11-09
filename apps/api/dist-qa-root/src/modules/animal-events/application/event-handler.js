"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventHandlerRegistry = void 0;
const common_1 = require("@nestjs/common");
let EventHandlerRegistry = class EventHandlerRegistry {
    handlers = new Map();
    recompute = [];
    onChange(fn) {
        this.recompute.push(fn);
    }
    async recomputeAll(farmId, cattleId) {
        for (const fn of this.recompute)
            await fn(farmId, cattleId);
    }
    register(types, handler) {
        for (const type of types) {
            if (this.handlers.has(type)) {
                throw new Error(`Event handler already registered: ${type}`);
            }
            this.handlers.set(type, handler);
        }
    }
    get(type) {
        return this.handlers.get(type);
    }
};
exports.EventHandlerRegistry = EventHandlerRegistry;
exports.EventHandlerRegistry = EventHandlerRegistry = __decorate([
    (0, common_1.Injectable)()
], EventHandlerRegistry);
//# sourceMappingURL=event-handler.js.map