"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseNumberAllocator = void 0;
const common_1 = require("@nestjs/common");
const purchase_number_1 = require("../domain/purchase-number");
let PurchaseNumberAllocator = class PurchaseNumberAllocator {
    async allocate(client, farmId) {
        const counter = await client.farmCounter.upsert({
            where: { scope: (0, purchase_number_1.purchaseCounterScope)(farmId) },
            create: { scope: (0, purchase_number_1.purchaseCounterScope)(farmId), value: 1 },
            update: { value: { increment: 1 } },
        });
        return (0, purchase_number_1.formatPurchaseNumber)(counter.value);
    }
};
exports.PurchaseNumberAllocator = PurchaseNumberAllocator;
exports.PurchaseNumberAllocator = PurchaseNumberAllocator = __decorate([
    (0, common_1.Injectable)()
], PurchaseNumberAllocator);
//# sourceMappingURL=purchase-number.allocator.js.map