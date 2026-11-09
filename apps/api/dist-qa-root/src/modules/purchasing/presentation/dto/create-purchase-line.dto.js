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
exports.CreatePurchaseLineDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dto_1 = require("src/common/dto");
const purchase_new_item_dto_1 = require("./purchase-new-item.dto");
class CreatePurchaseLineDto {
    medicineId;
    feedItemId;
    equipmentId;
    newItem;
    quantity;
    unitCost;
    expiryDate;
    batchCode;
}
exports.CreatePurchaseLineDto = CreatePurchaseLineDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePurchaseLineDto.prototype, "medicineId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePurchaseLineDto.prototype, "feedItemId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePurchaseLineDto.prototype, "equipmentId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => purchase_new_item_dto_1.PurchaseNewItemDto),
    __metadata("design:type", purchase_new_item_dto_1.PurchaseNewItemDto)
], CreatePurchaseLineDto.prototype, "newItem", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], CreatePurchaseLineDto.prototype, "quantity", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreatePurchaseLineDto.prototype, "unitCost", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => !!o.medicineId || o.newItem?.kind === 'MEDICINE'),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], CreatePurchaseLineDto.prototype, "expiryDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePurchaseLineDto.prototype, "batchCode", void 0);
//# sourceMappingURL=create-purchase-line.dto.js.map