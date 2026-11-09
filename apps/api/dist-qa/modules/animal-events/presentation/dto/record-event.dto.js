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
exports.RecordEventDto = exports.FollowUpToggleDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const catalogue_1 = require("../../domain/catalogue");
class FollowUpToggleDto {
    ruleKey;
    enabled;
}
exports.FollowUpToggleDto = FollowUpToggleDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], FollowUpToggleDto.prototype, "ruleKey", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], FollowUpToggleDto.prototype, "enabled", void 0);
class RecordEventDto {
    type;
    eventAt;
    provenance;
    notes;
    customTypeId;
    sourceEventId;
    payload;
    followUps;
}
exports.RecordEventDto = RecordEventDto;
__decorate([
    (0, class_validator_1.IsIn)(catalogue_1.ANIMAL_EVENT_TYPES),
    __metadata("design:type", String)
], RecordEventDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], RecordEventDto.prototype, "eventAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['RECORDED', 'HISTORICAL']),
    __metadata("design:type", String)
], RecordEventDto.prototype, "provenance", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], RecordEventDto.prototype, "notes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RecordEventDto.prototype, "customTypeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RecordEventDto.prototype, "sourceEventId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], RecordEventDto.prototype, "payload", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(20),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => FollowUpToggleDto),
    __metadata("design:type", Array)
], RecordEventDto.prototype, "followUps", void 0);
//# sourceMappingURL=record-event.dto.js.map