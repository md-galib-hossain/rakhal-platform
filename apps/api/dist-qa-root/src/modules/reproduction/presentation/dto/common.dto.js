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
exports.BooleanSymptomsDto = exports.ReproductionListQueryDto = exports.toBoolean = exports.trimString = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const pagination_1 = require("src/common/pagination");
const trimString = ({ value }) => typeof value === 'string' ? value.trim() : value;
exports.trimString = trimString;
const toBoolean = ({ value }) => {
    if (value === true || value === 'true')
        return true;
    if (value === false || value === 'false')
        return false;
    return value;
};
exports.toBoolean = toBoolean;
class ReproductionListQueryDto extends pagination_1.CursorPaginationQueryDto {
    cattleId;
    fromDate;
    toDate;
}
exports.ReproductionListQueryDto = ReproductionListQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(exports.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReproductionListQueryDto.prototype, "cattleId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ReproductionListQueryDto.prototype, "fromDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ReproductionListQueryDto.prototype, "toDate", void 0);
class BooleanSymptomsDto {
    standingHeat;
    mucusDischarge;
    mountingBehavior;
    restlessness;
}
exports.BooleanSymptomsDto = BooleanSymptomsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(exports.toBoolean),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], BooleanSymptomsDto.prototype, "standingHeat", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(exports.toBoolean),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], BooleanSymptomsDto.prototype, "mucusDischarge", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(exports.toBoolean),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], BooleanSymptomsDto.prototype, "mountingBehavior", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(exports.toBoolean),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], BooleanSymptomsDto.prototype, "restlessness", void 0);
//# sourceMappingURL=common.dto.js.map