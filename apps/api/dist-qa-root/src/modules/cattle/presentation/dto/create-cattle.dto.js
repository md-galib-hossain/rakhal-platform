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
exports.CreateCattleDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const cattle_constants_1 = require("../../domain/cattle.constants");
const common_dto_1 = require("./common.dto");
const intake_dto_1 = require("./intake.dto");
class CreateCattleDto {
    name;
    tagNumber;
    image;
    breedId;
    gender;
    dateOfBirth;
    status;
    productionStatus;
    intakePregnancy;
    intakeLactation;
    intakeHealthCondition;
    history;
    intakeBreeding;
    intakeHeat;
    lactationStartDate;
    priorCalvings;
    dryOffStartDate;
    weightKg;
    bcs;
    shedId;
    animalGroupId;
    motherId;
    fatherId;
    sourceType;
    color;
    notes;
}
exports.CreateCattleDto = CreateCattleDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCattleDto.prototype, "name", void 0);
__decorate([
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateCattleDto.prototype, "tagNumber", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCattleDto.prototype, "image", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCattleDto.prototype, "breedId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.CattleGender),
    __metadata("design:type", String)
], CreateCattleDto.prototype, "gender", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateCattleDto.prototype, "dateOfBirth", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.HerdStatus),
    __metadata("design:type", String)
], CreateCattleDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ProductionStatus),
    __metadata("design:type", String)
], CreateCattleDto.prototype, "productionStatus", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => intake_dto_1.IntakePregnancyDto),
    __metadata("design:type", intake_dto_1.IntakePregnancyDto)
], CreateCattleDto.prototype, "intakePregnancy", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => intake_dto_1.IntakeLactationDto),
    __metadata("design:type", intake_dto_1.IntakeLactationDto)
], CreateCattleDto.prototype, "intakeLactation", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => intake_dto_1.IntakeHealthConditionDto),
    __metadata("design:type", intake_dto_1.IntakeHealthConditionDto)
], CreateCattleDto.prototype, "intakeHealthCondition", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(20),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => intake_dto_1.HistoryItemDto),
    __metadata("design:type", Array)
], CreateCattleDto.prototype, "history", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => intake_dto_1.IntakeBreedingDto),
    __metadata("design:type", intake_dto_1.IntakeBreedingDto)
], CreateCattleDto.prototype, "intakeBreeding", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => intake_dto_1.IntakeHeatDto),
    __metadata("design:type", intake_dto_1.IntakeHeatDto)
], CreateCattleDto.prototype, "intakeHeat", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateCattleDto.prototype, "lactationStartDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateCattleDto.prototype, "priorCalvings", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateCattleDto.prototype, "dryOffStartDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(2000),
    __metadata("design:type", Number)
], CreateCattleDto.prototype, "weightKg", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsIn)(cattle_constants_1.BCS_ALLOWED_SCORES),
    __metadata("design:type", Number)
], CreateCattleDto.prototype, "bcs", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCattleDto.prototype, "shedId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCattleDto.prototype, "animalGroupId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCattleDto.prototype, "motherId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCattleDto.prototype, "fatherId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.CattleSourceType),
    __metadata("design:type", String)
], CreateCattleDto.prototype, "sourceType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCattleDto.prototype, "color", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCattleDto.prototype, "notes", void 0);
//# sourceMappingURL=create-cattle.dto.js.map