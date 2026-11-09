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
exports.HistoryItemDto = exports.HISTORY_KINDS = exports.IntakeHeatDto = exports.IntakeBreedingDto = exports.IntakeHealthConditionDto = exports.IntakeLactationDto = exports.IntakePregnancyDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const common_dto_1 = require("./common.dto");
class IntakePregnancyDto {
    conceptionDate;
    expectedCalvingDate;
}
exports.IntakePregnancyDto = IntakePregnancyDto;
__decorate([
    (0, class_validator_1.ValidateIf)((o) => !o.expectedCalvingDate),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], IntakePregnancyDto.prototype, "conceptionDate", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => !o.conceptionDate),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], IntakePregnancyDto.prototype, "expectedCalvingDate", void 0);
class IntakeLactationDto {
    estimatedDaysInMilk;
    estimatedCalvingDate;
    estimatedLactationNumber;
}
exports.IntakeLactationDto = IntakeLactationDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], IntakeLactationDto.prototype, "estimatedDaysInMilk", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], IntakeLactationDto.prototype, "estimatedCalvingDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], IntakeLactationDto.prototype, "estimatedLactationNumber", void 0);
class IntakeHealthConditionDto {
    note;
    condition;
    careType;
    priority;
    appetite;
    notes;
}
exports.IntakeHealthConditionDto = IntakeHealthConditionDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], IntakeHealthConditionDto.prototype, "note", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.HealthCondition),
    __metadata("design:type", String)
], IntakeHealthConditionDto.prototype, "condition", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.HealthCareType),
    __metadata("design:type", String)
], IntakeHealthConditionDto.prototype, "careType", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.HealthPriority),
    __metadata("design:type", String)
], IntakeHealthConditionDto.prototype, "priority", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.AppetiteStatus),
    __metadata("design:type", String)
], IntakeHealthConditionDto.prototype, "appetite", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], IntakeHealthConditionDto.prototype, "notes", void 0);
class IntakeBreedingDto {
    breedingDate;
    breedingMethod;
    notes;
}
exports.IntakeBreedingDto = IntakeBreedingDto;
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], IntakeBreedingDto.prototype, "breedingDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.BreedingMethod),
    __metadata("design:type", String)
], IntakeBreedingDto.prototype, "breedingMethod", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], IntakeBreedingDto.prototype, "notes", void 0);
class IntakeHeatDto {
    heatDateTime;
    notes;
}
exports.IntakeHeatDto = IntakeHeatDto;
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], IntakeHeatDto.prototype, "heatDateTime", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], IntakeHeatDto.prototype, "notes", void 0);
exports.HISTORY_KINDS = [
    'LAST_CALVING',
    'LAST_BREEDING',
    'PREGNANT',
    'MILKING_SINCE',
    'DRY_SINCE',
    'LAST_VACCINATION',
];
class HistoryItemDto {
    kind;
    date;
    calvingNumber;
    method;
    bull;
    expectedCalvingDate;
    monthsPregnant;
    product;
}
exports.HistoryItemDto = HistoryItemDto;
__decorate([
    (0, class_validator_1.IsIn)(exports.HISTORY_KINDS),
    __metadata("design:type", String)
], HistoryItemDto.prototype, "kind", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.kind !== 'PREGNANT'),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], HistoryItemDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(20),
    __metadata("design:type", Number)
], HistoryItemDto.prototype, "calvingNumber", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.BreedingMethod),
    __metadata("design:type", String)
], HistoryItemDto.prototype, "method", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], HistoryItemDto.prototype, "bull", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], HistoryItemDto.prototype, "expectedCalvingDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(9),
    __metadata("design:type", Number)
], HistoryItemDto.prototype, "monthsPregnant", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], HistoryItemDto.prototype, "product", void 0);
//# sourceMappingURL=intake.dto.js.map