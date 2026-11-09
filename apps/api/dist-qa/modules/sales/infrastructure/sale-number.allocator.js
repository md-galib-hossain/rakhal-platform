"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaleNumberAllocator = void 0;
const common_1 = require("@nestjs/common");
const sale_number_1 = require("../domain/sale-number");
let SaleNumberAllocator = class SaleNumberAllocator {
    async allocate(client, farmId) {
        const counter = await client.farmCounter.upsert({
            where: { scope: (0, sale_number_1.saleCounterScope)(farmId) },
            create: { scope: (0, sale_number_1.saleCounterScope)(farmId), value: 1 },
            update: { value: { increment: 1 } },
        });
        return (0, sale_number_1.formatSaleNumber)(counter.value);
    }
};
exports.SaleNumberAllocator = SaleNumberAllocator;
exports.SaleNumberAllocator = SaleNumberAllocator = __decorate([
    (0, common_1.Injectable)()
], SaleNumberAllocator);
//# sourceMappingURL=sale-number.allocator.js.map