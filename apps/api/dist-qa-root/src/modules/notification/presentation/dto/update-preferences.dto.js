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
exports.UpdatePreferencesDto = exports.PreferenceItemDto = exports.PreferenceChannelsDto = exports.QuietHoursDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
class QuietHoursDto {
    start;
    end;
}
exports.QuietHoursDto = QuietHoursDto;
__decorate([
    (0, class_validator_1.Matches)(HHMM, { message: 'start must be HH:mm' }),
    __metadata("design:type", String)
], QuietHoursDto.prototype, "start", void 0);
__decorate([
    (0, class_validator_1.Matches)(HHMM, { message: 'end must be HH:mm' }),
    __metadata("design:type", String)
], QuietHoursDto.prototype, "end", void 0);
class PreferenceChannelsDto {
    in_app;
    push;
    sms;
    whatsapp;
    telegram;
    email;
}
exports.PreferenceChannelsDto = PreferenceChannelsDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PreferenceChannelsDto.prototype, "in_app", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PreferenceChannelsDto.prototype, "push", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PreferenceChannelsDto.prototype, "sms", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PreferenceChannelsDto.prototype, "whatsapp", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PreferenceChannelsDto.prototype, "telegram", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PreferenceChannelsDto.prototype, "email", void 0);
class PreferenceItemDto {
    event_key;
    enabled;
    channels;
}
exports.PreferenceItemDto = PreferenceItemDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PreferenceItemDto.prototype, "event_key", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PreferenceItemDto.prototype, "enabled", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => PreferenceChannelsDto),
    __metadata("design:type", PreferenceChannelsDto)
], PreferenceItemDto.prototype, "channels", void 0);
class UpdatePreferencesDto {
    quiet_hours;
    preferences;
}
exports.UpdatePreferencesDto = UpdatePreferencesDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => QuietHoursDto),
    __metadata("design:type", QuietHoursDto)
], UpdatePreferencesDto.prototype, "quiet_hours", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => PreferenceItemDto),
    __metadata("design:type", Array)
], UpdatePreferencesDto.prototype, "preferences", void 0);
//# sourceMappingURL=update-preferences.dto.js.map