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
exports.RecordTreatmentDto = exports.SkipHealthTaskDto = exports.RescheduleHealthTaskDto = exports.CloseHealthCaseDto = exports.MortalityDto = exports.CreateHealthUpdateDto = exports.LogTaskTreatmentDto = exports.LogTreatmentDto = exports.ApplyHealthPlanDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const dto_1 = require("src/common/dto");
const common_dto_1 = require("./common.dto");
class ApplyHealthPlanDto {
    healthPlanId;
    startDate;
}
exports.ApplyHealthPlanDto = ApplyHealthPlanDto;
__decorate([
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ApplyHealthPlanDto.prototype, "healthPlanId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ApplyHealthPlanDto.prototype, "startDate", void 0);
class LogTreatmentDto {
    healthTaskId;
    medicineId;
    medicineName;
    doseAmount;
    doseUnit;
    doseUnitId;
    route;
    administeredAt;
    administeredBy;
    stockDeductionQuantity;
    batchNo;
    milkWithdrawalDays;
    meatWithdrawalDays;
    notes;
    outsideInventory;
    vetCost;
    financialAccountId;
}
exports.LogTreatmentDto = LogTreatmentDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LogTreatmentDto.prototype, "healthTaskId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LogTreatmentDto.prototype, "medicineId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LogTreatmentDto.prototype, "medicineName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], LogTreatmentDto.prototype, "doseAmount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LogTreatmentDto.prototype, "doseUnit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LogTreatmentDto.prototype, "doseUnitId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.MedicineRoute),
    __metadata("design:type", String)
], LogTreatmentDto.prototype, "route", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], LogTreatmentDto.prototype, "administeredAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LogTreatmentDto.prototype, "administeredBy", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], LogTreatmentDto.prototype, "stockDeductionQuantity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LogTreatmentDto.prototype, "batchNo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], LogTreatmentDto.prototype, "milkWithdrawalDays", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], LogTreatmentDto.prototype, "meatWithdrawalDays", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LogTreatmentDto.prototype, "notes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.toBoolean),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], LogTreatmentDto.prototype, "outsideInventory", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], LogTreatmentDto.prototype, "vetCost", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LogTreatmentDto.prototype, "financialAccountId", void 0);
class LogTaskTreatmentDto {
    medicineId;
    medicineName;
    doseAmount;
    doseUnit;
    route;
    administeredAt;
    administeredBy;
    stockDeductionQuantity;
    batchNo;
    milkWithdrawalDays;
    meatWithdrawalDays;
    notes;
    financialAccountId;
}
exports.LogTaskTreatmentDto = LogTaskTreatmentDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LogTaskTreatmentDto.prototype, "medicineId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LogTaskTreatmentDto.prototype, "medicineName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], LogTaskTreatmentDto.prototype, "doseAmount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LogTaskTreatmentDto.prototype, "doseUnit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.MedicineRoute),
    __metadata("design:type", String)
], LogTaskTreatmentDto.prototype, "route", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], LogTaskTreatmentDto.prototype, "administeredAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LogTaskTreatmentDto.prototype, "administeredBy", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], LogTaskTreatmentDto.prototype, "stockDeductionQuantity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LogTaskTreatmentDto.prototype, "batchNo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], LogTaskTreatmentDto.prototype, "milkWithdrawalDays", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], LogTaskTreatmentDto.prototype, "meatWithdrawalDays", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LogTaskTreatmentDto.prototype, "notes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LogTaskTreatmentDto.prototype, "financialAccountId", void 0);
class CreateHealthUpdateDto {
    clinicalProgress;
    symptoms;
    temperature;
    appetite;
    appearance;
    observation;
    recordedBy;
}
exports.CreateHealthUpdateDto = CreateHealthUpdateDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.ClinicalProgress),
    __metadata("design:type", String)
], CreateHealthUpdateDto.prototype, "clinicalProgress", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateHealthUpdateDto.prototype, "symptoms", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateHealthUpdateDto.prototype, "temperature", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.AppetiteStatus),
    __metadata("design:type", String)
], CreateHealthUpdateDto.prototype, "appetite", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.AppearanceStatus),
    __metadata("design:type", String)
], CreateHealthUpdateDto.prototype, "appearance", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateHealthUpdateDto.prototype, "observation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateHealthUpdateDto.prototype, "recordedBy", void 0);
class MortalityDto {
    deathDate;
    primaryCauseOfDeath;
    vetSignOff;
    symptoms;
    postMortemPerformed;
    disposalMethod;
    disposalCost;
    financialAccountId;
    disposalLocation;
    additionalNotes;
    recordedBy;
}
exports.MortalityDto = MortalityDto;
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], MortalityDto.prototype, "deathDate", void 0);
__decorate([
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], MortalityDto.prototype, "primaryCauseOfDeath", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MortalityDto.prototype, "vetSignOff", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], MortalityDto.prototype, "symptoms", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], MortalityDto.prototype, "postMortemPerformed", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MortalityDto.prototype, "disposalMethod", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], MortalityDto.prototype, "disposalCost", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MortalityDto.prototype, "financialAccountId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MortalityDto.prototype, "disposalLocation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MortalityDto.prototype, "additionalNotes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MortalityDto.prototype, "recordedBy", void 0);
class CloseHealthCaseDto {
    outcome;
    observation;
    mortality;
}
exports.CloseHealthCaseDto = CloseHealthCaseDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.HealthCloseOutcome),
    __metadata("design:type", String)
], CloseHealthCaseDto.prototype, "outcome", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CloseHealthCaseDto.prototype, "observation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", MortalityDto)
], CloseHealthCaseDto.prototype, "mortality", void 0);
class RescheduleHealthTaskDto {
    newDueDateTime;
    reason;
}
exports.RescheduleHealthTaskDto = RescheduleHealthTaskDto;
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], RescheduleHealthTaskDto.prototype, "newDueDateTime", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RescheduleHealthTaskDto.prototype, "reason", void 0);
class SkipHealthTaskDto {
    reason;
}
exports.SkipHealthTaskDto = SkipHealthTaskDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SkipHealthTaskDto.prototype, "reason", void 0);
class RecordTreatmentDto {
    cattleIds;
    medicineId;
    medicineName;
    outsideInventory;
    vetCost;
    doseAmount;
    doseUnit;
    doseUnitId;
    route;
    treatedAt;
    careType;
    reason;
    condition;
    notes;
    financialAccountId;
}
exports.RecordTreatmentDto = RecordTreatmentDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_transformer_1.Transform)(({ value }) => Array.isArray(value)
        ? [...new Set(value.map((v) => String(v).trim()))]
        : value),
    __metadata("design:type", Array)
], RecordTreatmentDto.prototype, "cattleIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RecordTreatmentDto.prototype, "medicineId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RecordTreatmentDto.prototype, "medicineName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.toBoolean),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RecordTreatmentDto.prototype, "outsideInventory", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], RecordTreatmentDto.prototype, "vetCost", void 0);
__decorate([
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.01),
    __metadata("design:type", Number)
], RecordTreatmentDto.prototype, "doseAmount", void 0);
__decorate([
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], RecordTreatmentDto.prototype, "doseUnit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RecordTreatmentDto.prototype, "doseUnitId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.MedicineRoute),
    __metadata("design:type", String)
], RecordTreatmentDto.prototype, "route", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], RecordTreatmentDto.prototype, "treatedAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.HealthCareType),
    __metadata("design:type", String)
], RecordTreatmentDto.prototype, "careType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RecordTreatmentDto.prototype, "reason", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.HealthCondition),
    __metadata("design:type", String)
], RecordTreatmentDto.prototype, "condition", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RecordTreatmentDto.prototype, "notes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RecordTreatmentDto.prototype, "financialAccountId", void 0);
//# sourceMappingURL=case-actions.dto.js.map