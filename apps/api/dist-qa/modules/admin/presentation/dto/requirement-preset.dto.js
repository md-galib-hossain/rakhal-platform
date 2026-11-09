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
exports.UpdateRequirementPresetDto = exports.CreateRequirementPresetDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateRequirementPresetDto {
    name;
    description;
    settings;
    effectiveFrom;
}
exports.CreateRequirementPresetDto = CreateRequirementPresetDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'NRC-2001 baseline (Bangladesh)' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreateRequirementPresetDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], CreateRequirementPresetDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'The tuning numbers this preset supplies. Partial is allowed — anything absent falls through to the built-in defaults.',
        example: { proteinPerLitreMilk: 88, tdnShareOfIntake: 0.7 },
    }),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateRequirementPresetDto.prototype, "settings", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'When this preset is meant to take effect. Recorded for audit; activation is still an explicit step.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateRequirementPresetDto.prototype, "effectiveFrom", void 0);
class UpdateRequirementPresetDto {
    name;
    description;
    settings;
}
exports.UpdateRequirementPresetDto = UpdateRequirementPresetDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], UpdateRequirementPresetDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], UpdateRequirementPresetDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: { proteinPerLitreMilk: 88 } }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateRequirementPresetDto.prototype, "settings", void 0);
//# sourceMappingURL=requirement-preset.dto.js.map