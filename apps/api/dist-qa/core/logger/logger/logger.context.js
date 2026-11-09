"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggerContext = void 0;
const async_hooks_1 = require("async_hooks");
const common_1 = require("@nestjs/common");
let LoggerContext = class LoggerContext {
    storage = new async_hooks_1.AsyncLocalStorage();
    run(context, fn) {
        return this.storage.run(context, fn);
    }
    get() {
        return this.storage.getStore();
    }
    set(key, value) {
        const store = this.storage.getStore();
        if (store)
            store[key] = value;
    }
    get requestId() {
        return this.get()?.requestId;
    }
    get userId() {
        return this.get()?.userId;
    }
};
exports.LoggerContext = LoggerContext;
exports.LoggerContext = LoggerContext = __decorate([
    (0, common_1.Injectable)()
], LoggerContext);
//# sourceMappingURL=logger.context.js.map