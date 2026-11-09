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
exports.NormalizeConcentrationDto = exports.BulkDeleteConcentrationDto = exports.UpdateConcentrationDto = exports.FinalizeConcentrationDto = exports.CreateConcentrationDto = exports.ConcentrationItemDto = exports.ListConcentrationsQueryDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const dto_1 = require("src/common/dto");
class ListConcentrationsQueryDto {
    kind;
    includeArchived = false;
}
exports.ListConcentrationsQueryDto = ListConcentrationsQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.FeedConcentrationKind),
    __metadata("design:type", String)
], ListConcentrationsQueryDto.prototype, "kind", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.toBoolean),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Object)
], ListConcentrationsQueryDto.prototype, "includeArchived", void 0);
class ConcentrationItemDto {
    ingredientId;
    amountKg;
    feedItemId;
    feedItemBatchId;
    feedStockId;
}
exports.ConcentrationItemDto = ConcentrationItemDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ConcentrationItemDto.prototype, "ingredientId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ConcentrationItemDto.prototype, "amountKg", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConcentrationItemDto.prototype, "feedItemId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConcentrationItemDto.prototype, "feedItemBatchId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConcentrationItemDto.prototype, "feedStockId", void 0);
class CreateConcentrationDto {
    kind;
    name;
    durationDays;
    targetType;
    cattleId;
    targetWeightKg;
    targetMilkL;
    items;
}
exports.CreateConcentrationDto = CreateConcentrationDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.FeedConcentrationKind),
    __metadata("design:type", String)
], CreateConcentrationDto.prototype, "kind", void 0);
__decorate([
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateConcentrationDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateConcentrationDto.prototype, "durationDays", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.FeedTargetType),
    __metadata("design:type", String)
], CreateConcentrationDto.prototype, "targetType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateConcentrationDto.prototype, "cattleId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateConcentrationDto.prototype, "targetWeightKg", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateConcentrationDto.prototype, "targetMilkL", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayNotEmpty)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ConcentrationItemDto),
    __metadata("design:type", Array)
], CreateConcentrationDto.prototype, "items", void 0);
class FinalizeConcentrationDto {
    paymentMethod;
    financialAccountId;
    batchQuantityKg;
}
exports.FinalizeConcentrationDto = FinalizeConcentrationDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.PaymentMethod),
    __metadata("design:type", String)
], FinalizeConcentrationDto.prototype, "paymentMethod", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], FinalizeConcentrationDto.prototype, "financialAccountId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.001),
    __metadata("design:type", Number)
], FinalizeConcentrationDto.prototype, "batchQuantityKg", void 0);
class UpdateConcentrationDto {
    name;
    durationDays;
    targetType;
    cattleId;
    targetWeightKg;
    targetMilkL;
    items;
}
exports.UpdateConcentrationDto = UpdateConcentrationDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpdateConcentrationDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpdateConcentrationDto.prototype, "durationDays", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.FeedTargetType),
    __metadata("design:type", String)
], UpdateConcentrationDto.prototype, "targetType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateConcentrationDto.prototype, "cattleId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateConcentrationDto.prototype, "targetWeightKg", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateConcentrationDto.prototype, "targetMilkL", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ConcentrationItemDto),
    __metadata("design:type", Array)
], UpdateConcentrationDto.prototype, "items", void 0);
class BulkDeleteConcentrationDto {
    ids;
}
exports.BulkDeleteConcentrationDto = BulkDeleteConcentrationDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayNotEmpty)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], BulkDeleteConcentrationDto.prototype, "ids", void 0);
class NormalizeConcentrationDto {
    weightKg;
    milkTargetL;
    milkFatPct;
    items;
}
exports.NormalizeConcentrationDto = NormalizeConcentrationDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], NormalizeConcentrationDto.prototype, "weightKg", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], NormalizeConcentrationDto.prototype, "milkTargetL", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], NormalizeConcentrationDto.prototype, "milkFatPct", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayNotEmpty)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ConcentrationItemDto),
    __metadata("design:type", Array)
], NormalizeConcentrationDto.prototype, "items", void 0);
//# sourceMappingURL=concentration.dto.js.map