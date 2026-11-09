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
exports.ListCattleEventsDto = exports.EligibleEventsDto = exports.EVENT_GROUPS = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
exports.EVENT_GROUPS = [
    'REPRODUCTION',
    'HEALTH',
    'GROWTH',
    'MOVEMENT',
    'OTHER',
];
class EligibleEventsDto {
    date;
}
exports.EligibleEventsDto = EligibleEventsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], EligibleEventsDto.prototype, "date", void 0);
class ListCattleEventsDto {
    cursor;
    limit = 30;
    includeVoided;
    group;
}
exports.ListCattleEventsDto = ListCattleEventsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListCattleEventsDto.prototype, "cursor", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], ListCattleEventsDto.prototype, "limit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => value === true || value === 'true' || value === '1'),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ListCattleEventsDto.prototype, "includeVoided", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.EVENT_GROUPS),
    __metadata("design:type", Object)
], ListCattleEventsDto.prototype, "group", void 0);
//# sourceMappingURL=list-cattle-events.dto.js.map