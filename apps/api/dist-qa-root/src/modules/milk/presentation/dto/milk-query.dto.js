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
exports.MilkAvailabilityQueryDto = exports.MilkAnomalyQueryDto = exports.MilkLogQueryDto = exports.MilkOverviewQueryDto = exports.MILK_TREND_RANGES = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const dto_1 = require("src/common/dto");
const pagination_1 = require("src/common/pagination");
exports.MILK_TREND_RANGES = [
    '7d',
    '30d',
    '3m',
    '6m',
    '1y',
    'lifetime',
];
class MilkOverviewQueryDto {
    date;
    range;
}
exports.MilkOverviewQueryDto = MilkOverviewQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], MilkOverviewQueryDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(exports.MILK_TREND_RANGES),
    __metadata("design:type", String)
], MilkOverviewQueryDto.prototype, "range", void 0);
class MilkLogQueryDto {
    date;
    shedId;
    session;
}
exports.MilkLogQueryDto = MilkLogQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], MilkLogQueryDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MilkLogQueryDto.prototype, "shedId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.MilkSession),
    __metadata("design:type", String)
], MilkLogQueryDto.prototype, "session", void 0);
class MilkAnomalyQueryDto extends pagination_1.CursorPaginationQueryDto {
    date;
}
exports.MilkAnomalyQueryDto = MilkAnomalyQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], MilkAnomalyQueryDto.prototype, "date", void 0);
class MilkAvailabilityQueryDto {
    tankId;
}
exports.MilkAvailabilityQueryDto = MilkAvailabilityQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MilkAvailabilityQueryDto.prototype, "tankId", void 0);
//# sourceMappingURL=milk-query.dto.js.map