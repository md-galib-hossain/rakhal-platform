"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FarmTimeModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("src/core/database/prisma/prisma.module");
const farm_clock_service_1 = require("./farm-clock.service");
let FarmTimeModule = class FarmTimeModule {
};
exports.FarmTimeModule = FarmTimeModule;
exports.FarmTimeModule = FarmTimeModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule],
        providers: [farm_clock_service_1.FarmClockService],
        exports: [farm_clock_service_1.FarmClockService],
    })
], FarmTimeModule);
//# sourceMappingURL=farm-time.module.js.map