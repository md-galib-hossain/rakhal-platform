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
exports.EditPregnancyDiagnosisDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const common_dto_1 = require("./common.dto");
class EditPregnancyDiagnosisDto {
    cattleId;
    breedingEventId;
    diagnosisDate;
    result;
    diagnosisMethod;
    gestationDay;
    expectedCalvingDate;
    notes;
}
exports.EditPregnancyDiagnosisDto = EditPregnancyDiagnosisDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EditPregnancyDiagnosisDto.prototype, "cattleId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EditPregnancyDiagnosisDto.prototype, "breedingEventId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], EditPregnancyDiagnosisDto.prototype, "diagnosisDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.PregnancyDiagnosisResult),
    __metadata("design:type", String)
], EditPregnancyDiagnosisDto.prototype, "result", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.PregnancyDiagnosisMethod),
    __metadata("design:type", String)
], EditPregnancyDiagnosisDto.prototype, "diagnosisMethod", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], EditPregnancyDiagnosisDto.prototype, "gestationDay", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], EditPregnancyDiagnosisDto.prototype, "expectedCalvingDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EditPregnancyDiagnosisDto.prototype, "notes", void 0);
//# sourceMappingURL=edit-pregnancy-diagnosis.dto.js.map