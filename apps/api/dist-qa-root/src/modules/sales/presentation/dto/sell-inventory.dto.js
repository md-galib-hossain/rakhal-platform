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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SellInventoryDto = void 0;
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
class SellInventoryDto {
    itemType;
    itemId;
    quantity;
    unitPrice;
    discountAmount;
    notes;
    saleDate;
    financialAccountId;
    amountReceived;
    paymentMethod;
}
exports.SellInventoryDto = SellInventoryDto;
__decorate([
    (0, class_validator_1.IsIn)(['MEDICINE', 'FEED_ITEM', 'EQUIPMENT']),
    __metadata("design:type", String)
], SellInventoryDto.prototype, "itemType", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SellInventoryDto.prototype, "itemId", void 0);
__decorate([
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], SellInventoryDto.prototype, "quantity", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SellInventoryDto.prototype, "unitPrice", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SellInventoryDto.prototype, "discountAmount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SellInventoryDto.prototype, "notes", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], SellInventoryDto.prototype, "saleDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SellInventoryDto.prototype, "financialAccountId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], SellInventoryDto.prototype, "amountReceived", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(Object.values(client_1.PaymentMethod)),
    __metadata("design:type", String)
], SellInventoryDto.prototype, "paymentMethod", void 0);
//# sourceMappingURL=sell-inventory.dto.js.map