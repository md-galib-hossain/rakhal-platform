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
exports.AdminIssueCouponDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const client_1 = require("@prisma/client");
const dto_1 = require("src/common/dto");
class AdminIssueCouponDto {
    code;
    type;
    value;
    maxRedemptions;
    perFarmLimit;
    validFrom;
    validUntil;
    applicablePlanIds;
    minSpend;
}
exports.AdminIssueCouponDto = AdminIssueCouponDto;
__decorate([
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AdminIssueCouponDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.CouponType),
    __metadata("design:type", String)
], AdminIssueCouponDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AdminIssueCouponDto.prototype, "value", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AdminIssueCouponDto.prototype, "maxRedemptions", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AdminIssueCouponDto.prototype, "perFarmLimit", void 0);
__decorate([
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], AdminIssueCouponDto.prototype, "validFrom", void 0);
__decorate([
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], AdminIssueCouponDto.prototype, "validUntil", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayUnique)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], AdminIssueCouponDto.prototype, "applicablePlanIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AdminIssueCouponDto.prototype, "minSpend", void 0);
//# sourceMappingURL=admin-issue-coupon.dto.js.map