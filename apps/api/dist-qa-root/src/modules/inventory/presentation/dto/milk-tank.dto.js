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
exports.ListMilkTankAuditQueryDto = exports.ListMilkTankQueryDto = exports.AdjustMilkTankVolumeDto = exports.UpdateMilkTankDto = exports.CreateMilkTankDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const pagination_1 = require("src/common/pagination");
const dto_1 = require("src/common/dto");
class CreateMilkTankDto {
    name;
    tankType;
    totalCapacityL;
    currentVolumeL;
    fatPct;
    proteinPct;
    snfPct;
    smartSensorId;
    targetTempC;
    agitationIntervalMin;
    assignedShedId;
}
exports.CreateMilkTankDto = CreateMilkTankDto;
__decorate([
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateMilkTankDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.MilkTankType),
    __metadata("design:type", String)
], CreateMilkTankDto.prototype, "tankType", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateMilkTankDto.prototype, "totalCapacityL", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateMilkTankDto.prototype, "currentVolumeL", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], CreateMilkTankDto.prototype, "fatPct", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], CreateMilkTankDto.prototype, "proteinPct", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], CreateMilkTankDto.prototype, "snfPct", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateMilkTankDto.prototype, "smartSensorId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateMilkTankDto.prototype, "targetTempC", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateMilkTankDto.prototype, "agitationIntervalMin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateMilkTankDto.prototype, "assignedShedId", void 0);
class UpdateMilkTankDto {
    name;
    tankType;
    totalCapacityL;
    fatPct;
    proteinPct;
    snfPct;
    smartSensorId;
    targetTempC;
    agitationIntervalMin;
    assignedShedId;
}
exports.UpdateMilkTankDto = UpdateMilkTankDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpdateMilkTankDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.MilkTankType),
    __metadata("design:type", String)
], UpdateMilkTankDto.prototype, "tankType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateMilkTankDto.prototype, "totalCapacityL", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], UpdateMilkTankDto.prototype, "fatPct", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], UpdateMilkTankDto.prototype, "proteinPct", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], UpdateMilkTankDto.prototype, "snfPct", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateMilkTankDto.prototype, "smartSensorId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateMilkTankDto.prototype, "targetTempC", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateMilkTankDto.prototype, "agitationIntervalMin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateMilkTankDto.prototype, "assignedShedId", void 0);
class AdjustMilkTankVolumeDto {
    delta;
    activityType;
    source;
    notes;
    saleLineId;
}
exports.AdjustMilkTankVolumeDto = AdjustMilkTankVolumeDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], AdjustMilkTankVolumeDto.prototype, "delta", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.MilkTankActivity),
    __metadata("design:type", String)
], AdjustMilkTankVolumeDto.prototype, "activityType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AdjustMilkTankVolumeDto.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AdjustMilkTankVolumeDto.prototype, "notes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AdjustMilkTankVolumeDto.prototype, "saleLineId", void 0);
class ListMilkTankQueryDto {
    tankType;
    includeArchived = false;
}
exports.ListMilkTankQueryDto = ListMilkTankQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.MilkTankType),
    __metadata("design:type", String)
], ListMilkTankQueryDto.prototype, "tankType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.toBoolean),
    __metadata("design:type", Object)
], ListMilkTankQueryDto.prototype, "includeArchived", void 0);
class ListMilkTankAuditQueryDto extends pagination_1.CursorPaginationQueryDto {
    tankId;
}
exports.ListMilkTankAuditQueryDto = ListMilkTankAuditQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListMilkTankAuditQueryDto.prototype, "tankId", void 0);
//# sourceMappingURL=milk-tank.dto.js.map