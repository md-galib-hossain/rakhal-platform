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
exports.RetryJobDto = exports.SetSettingDto = exports.UpdateFlagDto = exports.CreateFlagDto = exports.ConfigReasonDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dto_1 = require("src/common/dto");
const platform_config_1 = require("../../domain/platform-config");
const KEY_MESSAGE = 'key must be lower-case, start with a letter and be 3-64 characters of a-z 0-9 _ . -';
class ConfigReasonDto {
    reason;
}
exports.ConfigReasonDto = ConfigReasonDto;
__decorate([
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(10, { message: 'reason must be at least 10 characters' }),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], ConfigReasonDto.prototype, "reason", void 0);
class CreateFlagDto extends ConfigReasonDto {
    key;
    description;
    enabled;
    farmIds;
}
exports.CreateFlagDto = CreateFlagDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(platform_config_1.CONFIG_KEY_PATTERN, { message: KEY_MESSAGE }),
    __metadata("design:type", String)
], CreateFlagDto.prototype, "key", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], CreateFlagDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateFlagDto.prototype, "enabled", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MaxLength)(64, { each: true }),
    __metadata("design:type", Array)
], CreateFlagDto.prototype, "farmIds", void 0);
class UpdateFlagDto extends ConfigReasonDto {
    description;
    enabled;
    farmIds;
}
exports.UpdateFlagDto = UpdateFlagDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], UpdateFlagDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateFlagDto.prototype, "enabled", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MaxLength)(64, { each: true }),
    __metadata("design:type", Array)
], UpdateFlagDto.prototype, "farmIds", void 0);
class SetSettingDto extends ConfigReasonDto {
    value;
    description;
}
exports.SetSettingDto = SetSettingDto;
__decorate([
    (0, class_validator_1.IsDefined)(),
    __metadata("design:type", Object)
], SetSettingDto.prototype, "value", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], SetSettingDto.prototype, "description", void 0);
class RetryJobDto extends ConfigReasonDto {
}
exports.RetryJobDto = RetryJobDto;
//# sourceMappingURL=admin-config.dto.js.map