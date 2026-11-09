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
exports.PurchaseNewItemDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const dto_1 = require("src/common/dto");
const nutrition_input_dto_1 = require("src/modules/inventory/presentation/dto/nutrition-input.dto");
const purchase_line_shape_1 = require("../../domain/purchase-line-shape");
class PurchaseNewItemDto {
    kind;
    name;
    unitId;
    lowStockThreshold;
    notes;
    medicineType;
    medicineCategory;
    manufacturer;
    milkWithdrawalDays;
    meatWithdrawalDays;
    feedClass;
    feedSubType;
    ingredientId;
    nutrition;
    kgPerUnit;
    equipmentType;
    assetId;
}
exports.PurchaseNewItemDto = PurchaseNewItemDto;
__decorate([
    (0, class_validator_1.IsEnum)(purchase_line_shape_1.PURCHASE_NEW_ITEM_KINDS),
    __metadata("design:type", String)
], PurchaseNewItemDto.prototype, "kind", void 0);
__decorate([
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], PurchaseNewItemDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.kind !== 'EQUIPMENT' || o.unitId !== undefined),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], PurchaseNewItemDto.prototype, "unitId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], PurchaseNewItemDto.prototype, "lowStockThreshold", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PurchaseNewItemDto.prototype, "notes", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.kind === 'MEDICINE'),
    (0, class_validator_1.IsEnum)(client_1.MedicineType),
    __metadata("design:type", String)
], PurchaseNewItemDto.prototype, "medicineType", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.kind === 'MEDICINE'),
    (0, class_validator_1.IsEnum)(client_1.MedicineCategory),
    __metadata("design:type", String)
], PurchaseNewItemDto.prototype, "medicineCategory", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PurchaseNewItemDto.prototype, "manufacturer", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], PurchaseNewItemDto.prototype, "milkWithdrawalDays", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], PurchaseNewItemDto.prototype, "meatWithdrawalDays", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.kind === 'FEED'),
    (0, class_validator_1.IsEnum)(client_1.FeedClass),
    __metadata("design:type", String)
], PurchaseNewItemDto.prototype, "feedClass", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.FeedSubType),
    __metadata("design:type", String)
], PurchaseNewItemDto.prototype, "feedSubType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], PurchaseNewItemDto.prototype, "ingredientId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => nutrition_input_dto_1.NutritionInputDto),
    __metadata("design:type", nutrition_input_dto_1.NutritionInputDto)
], PurchaseNewItemDto.prototype, "nutrition", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], PurchaseNewItemDto.prototype, "kgPerUnit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.EquipmentType),
    __metadata("design:type", String)
], PurchaseNewItemDto.prototype, "equipmentType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PurchaseNewItemDto.prototype, "assetId", void 0);
//# sourceMappingURL=purchase-new-item.dto.js.map