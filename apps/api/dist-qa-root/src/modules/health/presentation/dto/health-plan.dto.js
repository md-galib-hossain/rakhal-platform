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
exports.ApplyPlanToAnimalsDto = exports.UpdateHealthPlanDto = exports.CreateHealthPlanDto = exports.HealthPlanStepDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const common_dto_1 = require("./common.dto");
class HealthPlanStepDto {
    dayNumber;
    title;
    actionType;
    medicineId;
    medicineName;
    doseAmount;
    doseUnit;
    doseUnitId;
    timeOfDay;
    route;
    instruction;
    estimatedTime;
    milkWithdrawalDays;
    meatWithdrawalDays;
    isRequired;
}
exports.HealthPlanStepDto = HealthPlanStepDto;
__decorate([
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], HealthPlanStepDto.prototype, "dayNumber", void 0);
__decorate([
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], HealthPlanStepDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.HealthActionType),
    __metadata("design:type", String)
], HealthPlanStepDto.prototype, "actionType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], HealthPlanStepDto.prototype, "medicineId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], HealthPlanStepDto.prototype, "medicineName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], HealthPlanStepDto.prototype, "doseAmount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], HealthPlanStepDto.prototype, "doseUnit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], HealthPlanStepDto.prototype, "doseUnitId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => value === '' ? undefined : value),
    (0, class_validator_1.Matches)(/^([01]\d|2[0-3]):[0-5]\d$/, {
        message: 'timeOfDay must be HH:mm (24h)',
    }),
    __metadata("design:type", String)
], HealthPlanStepDto.prototype, "timeOfDay", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.MedicineRoute),
    __metadata("design:type", String)
], HealthPlanStepDto.prototype, "route", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], HealthPlanStepDto.prototype, "instruction", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], HealthPlanStepDto.prototype, "estimatedTime", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], HealthPlanStepDto.prototype, "milkWithdrawalDays", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], HealthPlanStepDto.prototype, "meatWithdrawalDays", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], HealthPlanStepDto.prototype, "isRequired", void 0);
class CreateHealthPlanDto {
    name;
    category;
    planType;
    condition;
    description;
    diagnosis;
    cycleLengthDays;
    isTemplate;
    steps;
}
exports.CreateHealthPlanDto = CreateHealthPlanDto;
__decorate([
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateHealthPlanDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.HealthPlanCategory),
    __metadata("design:type", String)
], CreateHealthPlanDto.prototype, "category", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.HealthPlanType),
    __metadata("design:type", String)
], CreateHealthPlanDto.prototype, "planType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.HealthCondition),
    __metadata("design:type", String)
], CreateHealthPlanDto.prototype, "condition", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateHealthPlanDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateHealthPlanDto.prototype, "diagnosis", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateHealthPlanDto.prototype, "cycleLengthDays", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateHealthPlanDto.prototype, "isTemplate", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => HealthPlanStepDto),
    __metadata("design:type", Array)
], CreateHealthPlanDto.prototype, "steps", void 0);
class UpdateHealthPlanDto {
    name;
    category;
    planType;
    condition;
    description;
    diagnosis;
    cycleLengthDays;
    isTemplate;
    steps;
}
exports.UpdateHealthPlanDto = UpdateHealthPlanDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateHealthPlanDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.HealthPlanCategory),
    __metadata("design:type", String)
], UpdateHealthPlanDto.prototype, "category", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.HealthPlanType),
    __metadata("design:type", String)
], UpdateHealthPlanDto.prototype, "planType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.HealthCondition),
    __metadata("design:type", Object)
], UpdateHealthPlanDto.prototype, "condition", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateHealthPlanDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateHealthPlanDto.prototype, "diagnosis", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateHealthPlanDto.prototype, "cycleLengthDays", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateHealthPlanDto.prototype, "isTemplate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => HealthPlanStepDto),
    __metadata("design:type", Array)
], UpdateHealthPlanDto.prototype, "steps", void 0);
class ApplyPlanToAnimalsDto {
    cattleIds;
    startDate;
    route;
}
exports.ApplyPlanToAnimalsDto = ApplyPlanToAnimalsDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_transformer_1.Transform)(({ value }) => Array.isArray(value)
        ? [...new Set(value.map((v) => String(v).trim()))]
        : value),
    __metadata("design:type", Array)
], ApplyPlanToAnimalsDto.prototype, "cattleIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ApplyPlanToAnimalsDto.prototype, "startDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.MedicineRoute),
    __metadata("design:type", String)
], ApplyPlanToAnimalsDto.prototype, "route", void 0);
//# sourceMappingURL=health-plan.dto.js.map