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
exports.ConfigureOnboardingDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dto_1 = require("src/common/dto");
class OnboardingShedDto {
    name;
    capacity;
    purpose;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    __metadata("design:type", String)
], OnboardingShedDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], OnboardingShedDto.prototype, "capacity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    __metadata("design:type", String)
], OnboardingShedDto.prototype, "purpose", void 0);
class ConfigureOnboardingDto {
    sheds;
    active_sessions;
    milk_unit;
}
exports.ConfigureOnboardingDto = ConfigureOnboardingDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(10),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => OnboardingShedDto),
    __metadata("design:type", Array)
], ConfigureOnboardingDto.prototype, "sheds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsIn)(['morning', 'noon', 'evening', 'night'], { each: true }),
    __metadata("design:type", Array)
], ConfigureOnboardingDto.prototype, "active_sessions", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['litres', 'kg']),
    __metadata("design:type", String)
], ConfigureOnboardingDto.prototype, "milk_unit", void 0);
//# sourceMappingURL=configure-onboarding.dto.js.map