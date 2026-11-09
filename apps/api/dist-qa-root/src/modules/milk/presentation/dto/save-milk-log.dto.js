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
exports.SaveMilkLogDto = exports.MilkLogEntryDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const dto_1 = require("src/common/dto");
class MilkLogEntryDto {
    cattleId;
    yieldL;
    anomalyNote;
    tankId;
    editReason;
}
exports.MilkLogEntryDto = MilkLogEntryDto;
__decorate([
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], MilkLogEntryDto.prototype, "cattleId", void 0);
__decorate([
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100, { message: 'yieldL must not exceed 100 L per session' }),
    __metadata("design:type", Number)
], MilkLogEntryDto.prototype, "yieldL", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MilkLogEntryDto.prototype, "anomalyNote", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MilkLogEntryDto.prototype, "tankId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MilkLogEntryDto.prototype, "editReason", void 0);
class SaveMilkLogDto {
    date;
    session;
    entries;
}
exports.SaveMilkLogDto = SaveMilkLogDto;
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], SaveMilkLogDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.MilkSession),
    __metadata("design:type", String)
], SaveMilkLogDto.prototype, "session", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => MilkLogEntryDto),
    __metadata("design:type", Array)
], SaveMilkLogDto.prototype, "entries", void 0);
//# sourceMappingURL=save-milk-log.dto.js.map