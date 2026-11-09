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
exports.CreateNotificationScheduleDto = exports.ScheduleAudienceDto = exports.ScheduleRepeatDto = exports.ScheduleAnchorDto = exports.SCHEDULE_AUDIENCE_MODES = exports.SCHEDULE_REPEAT_TYPES = exports.SCHEDULE_ANCHOR_TYPES = exports.SCHEDULE_TRIGGERS = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dto_1 = require("src/common/dto");
exports.SCHEDULE_TRIGGERS = [
    'DATE',
    'BEFORE_EVENT',
    'AFTER_EVENT',
];
exports.SCHEDULE_ANCHOR_TYPES = [
    'ANIMAL_EVENT',
    'TASK',
    'HEALTH_STEP',
];
exports.SCHEDULE_REPEAT_TYPES = [
    'NEVER',
    'EVERY_N_DAYS',
    'WEEKLY',
    'MONTHLY',
];
exports.SCHEDULE_AUDIENCE_MODES = ['USER', 'ROLES', 'USERS'];
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
class ScheduleAnchorDto {
    type;
    id;
}
exports.ScheduleAnchorDto = ScheduleAnchorDto;
__decorate([
    (0, class_validator_1.IsIn)(exports.SCHEDULE_ANCHOR_TYPES),
    __metadata("design:type", Object)
], ScheduleAnchorDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], ScheduleAnchorDto.prototype, "id", void 0);
class ScheduleRepeatDto {
    type;
    interval;
    end_date;
}
exports.ScheduleRepeatDto = ScheduleRepeatDto;
__decorate([
    (0, class_validator_1.IsIn)(exports.SCHEDULE_REPEAT_TYPES),
    __metadata("design:type", Object)
], ScheduleRepeatDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], ScheduleRepeatDto.prototype, "interval", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(YMD),
    __metadata("design:type", String)
], ScheduleRepeatDto.prototype, "end_date", void 0);
class ScheduleAudienceDto {
    mode;
    user_id;
    roles;
    user_ids;
}
exports.ScheduleAudienceDto = ScheduleAudienceDto;
__decorate([
    (0, class_validator_1.IsIn)(exports.SCHEDULE_AUDIENCE_MODES),
    __metadata("design:type", Object)
], ScheduleAudienceDto.prototype, "mode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], ScheduleAudienceDto.prototype, "user_id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(20),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], ScheduleAudienceDto.prototype, "roles", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(101),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], ScheduleAudienceDto.prototype, "user_ids", void 0);
class CreateNotificationScheduleDto {
    title;
    body;
    trigger;
    date;
    time;
    anchor;
    offset_days;
    repeat;
    lead_minutes;
    audience;
    animal_ids;
}
exports.CreateNotificationScheduleDto = CreateNotificationScheduleDto;
__decorate([
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreateNotificationScheduleDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], CreateNotificationScheduleDto.prototype, "body", void 0);
__decorate([
    (0, class_validator_1.IsIn)(exports.SCHEDULE_TRIGGERS),
    __metadata("design:type", Object)
], CreateNotificationScheduleDto.prototype, "trigger", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(YMD),
    __metadata("design:type", String)
], CreateNotificationScheduleDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(HM),
    __metadata("design:type", String)
], CreateNotificationScheduleDto.prototype, "time", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => ScheduleAnchorDto),
    __metadata("design:type", ScheduleAnchorDto)
], CreateNotificationScheduleDto.prototype, "anchor", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(3650),
    __metadata("design:type", Number)
], CreateNotificationScheduleDto.prototype, "offset_days", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => ScheduleRepeatDto),
    __metadata("design:type", ScheduleRepeatDto)
], CreateNotificationScheduleDto.prototype, "repeat", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(4),
    (0, class_validator_1.IsInt)({ each: true }),
    __metadata("design:type", Array)
], CreateNotificationScheduleDto.prototype, "lead_minutes", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => ScheduleAudienceDto),
    __metadata("design:type", ScheduleAudienceDto)
], CreateNotificationScheduleDto.prototype, "audience", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateNotificationScheduleDto.prototype, "animal_ids", void 0);
//# sourceMappingURL=create-notification-schedule.dto.js.map