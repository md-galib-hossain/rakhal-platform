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
exports.AppliedPlansQueryDto = exports.SafetyWithdrawalQueryDto = exports.HealthTaskCalendarQueryDto = exports.HealthTaskQueryDto = exports.PlanRunsQueryDto = exports.HealthPlanQueryDto = exports.MorbidityTrendQueryDto = exports.HealthOutcomesQueryDto = exports.TreatmentLogsQueryDto = exports.SickBayQueryDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const dto_1 = require("src/common/dto");
const pagination_1 = require("src/common/pagination");
const common_dto_1 = require("./common.dto");
class SickBayQueryDto extends common_dto_1.HealthListQueryDto {
    shed;
    diagnosis;
    priority;
    status;
}
exports.SickBayQueryDto = SickBayQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SickBayQueryDto.prototype, "shed", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SickBayQueryDto.prototype, "diagnosis", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.HealthPriority),
    __metadata("design:type", String)
], SickBayQueryDto.prototype, "priority", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.HealthCaseStatus),
    __metadata("design:type", String)
], SickBayQueryDto.prototype, "status", void 0);
class TreatmentLogsQueryDto extends common_dto_1.HealthListQueryDto {
    careType;
    route;
}
exports.TreatmentLogsQueryDto = TreatmentLogsQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.HealthCareType),
    __metadata("design:type", String)
], TreatmentLogsQueryDto.prototype, "careType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.MedicineRoute),
    __metadata("design:type", String)
], TreatmentLogsQueryDto.prototype, "route", void 0);
class HealthOutcomesQueryDto {
    days;
}
exports.HealthOutcomesQueryDto = HealthOutcomesQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(7),
    (0, class_validator_1.Max)(3650),
    __metadata("design:type", Number)
], HealthOutcomesQueryDto.prototype, "days", void 0);
class MorbidityTrendQueryDto {
    days;
}
exports.MorbidityTrendQueryDto = MorbidityTrendQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(7),
    (0, class_validator_1.Max)(3650),
    __metadata("design:type", Number)
], MorbidityTrendQueryDto.prototype, "days", void 0);
class HealthPlanQueryDto extends common_dto_1.HealthListQueryDto {
    category;
    condition;
    planType;
    kind;
    inUse;
}
exports.HealthPlanQueryDto = HealthPlanQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.HealthPlanCategory),
    __metadata("design:type", String)
], HealthPlanQueryDto.prototype, "category", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.HealthCondition),
    __metadata("design:type", String)
], HealthPlanQueryDto.prototype, "condition", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.HealthPlanType),
    __metadata("design:type", String)
], HealthPlanQueryDto.prototype, "planType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['TREATMENT', 'PREVENTION', 'BREEDING']),
    __metadata("design:type", String)
], HealthPlanQueryDto.prototype, "kind", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.toBoolean),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], HealthPlanQueryDto.prototype, "inUse", void 0);
class PlanRunsQueryDto extends pagination_1.CursorPaginationQueryDto {
    status = 'active';
    search;
}
exports.PlanRunsQueryDto = PlanRunsQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['active', 'all']),
    __metadata("design:type", String)
], PlanRunsQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PlanRunsQueryDto.prototype, "search", void 0);
class HealthTaskQueryDto extends common_dto_1.HealthListQueryDto {
    date;
    status;
    statuses;
    healthPlanId;
    noPlan;
    dueTo;
    sortBy;
    type;
    healthCaseId;
}
exports.HealthTaskQueryDto = HealthTaskQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], HealthTaskQueryDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.HealthTaskStatus),
    __metadata("design:type", String)
], HealthTaskQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => typeof value === 'string'
        ? value
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
        : value),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsEnum)(client_1.HealthTaskStatus, { each: true }),
    __metadata("design:type", Array)
], HealthTaskQueryDto.prototype, "statuses", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], HealthTaskQueryDto.prototype, "healthPlanId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.toBoolean),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], HealthTaskQueryDto.prototype, "noPlan", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/, { message: 'dueTo must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], HealthTaskQueryDto.prototype, "dueTo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['created', 'due']),
    __metadata("design:type", String)
], HealthTaskQueryDto.prototype, "sortBy", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.HealthActionType),
    __metadata("design:type", String)
], HealthTaskQueryDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], HealthTaskQueryDto.prototype, "healthCaseId", void 0);
class HealthTaskCalendarQueryDto {
    month;
    year;
}
exports.HealthTaskCalendarQueryDto = HealthTaskCalendarQueryDto;
__decorate([
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(12),
    __metadata("design:type", Number)
], HealthTaskCalendarQueryDto.prototype, "month", void 0);
__decorate([
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(2000),
    __metadata("design:type", Number)
], HealthTaskCalendarQueryDto.prototype, "year", void 0);
class SafetyWithdrawalQueryDto extends common_dto_1.HealthListQueryDto {
    status;
    activeOnly;
}
exports.SafetyWithdrawalQueryDto = SafetyWithdrawalQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.SafetyWithdrawalStatus),
    __metadata("design:type", String)
], SafetyWithdrawalQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.toBoolean),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SafetyWithdrawalQueryDto.prototype, "activeOnly", void 0);
class AppliedPlansQueryDto extends common_dto_1.HealthListQueryDto {
    healthPlanId;
}
exports.AppliedPlansQueryDto = AppliedPlansQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AppliedPlansQueryDto.prototype, "healthPlanId", void 0);
//# sourceMappingURL=health-query.dto.js.map