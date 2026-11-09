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
exports.ReportIdParamDto = exports.ListReportsQueryDto = exports.CreateReportDto = exports.PreviewReportDto = exports.ReportScopeDto = exports.ReportPeriodDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const pagination_1 = require("src/common/pagination");
const enums_1 = require("../../domain/contracts/enums");
const YMD = /^\d{4}-\d{2}-\d{2}$/;
class ReportPeriodDto {
    preset;
    customStartDate;
    customEndDate;
}
exports.ReportPeriodDto = ReportPeriodDto;
__decorate([
    (0, class_validator_1.IsIn)(enums_1.DATE_PRESETS),
    __metadata("design:type", String)
], ReportPeriodDto.prototype, "preset", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(YMD),
    __metadata("design:type", String)
], ReportPeriodDto.prototype, "customStartDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(YMD),
    __metadata("design:type", String)
], ReportPeriodDto.prototype, "customEndDate", void 0);
class ReportScopeDto {
    kind;
    cattleId;
    groupId;
}
exports.ReportScopeDto = ReportScopeDto;
__decorate([
    (0, class_validator_1.IsIn)(enums_1.REPORT_SCOPE_KINDS),
    __metadata("design:type", String)
], ReportScopeDto.prototype, "kind", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 64),
    __metadata("design:type", String)
], ReportScopeDto.prototype, "cattleId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 64),
    __metadata("design:type", String)
], ReportScopeDto.prototype, "groupId", void 0);
class PreviewReportDto {
    templateId;
    period;
    scope;
    selectedMetricIds;
    compare;
}
exports.PreviewReportDto = PreviewReportDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 64),
    __metadata("design:type", String)
], PreviewReportDto.prototype, "templateId", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => ReportPeriodDto),
    __metadata("design:type", ReportPeriodDto)
], PreviewReportDto.prototype, "period", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => ReportScopeDto),
    __metadata("design:type", ReportScopeDto)
], PreviewReportDto.prototype, "scope", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.Length)(1, 100, { each: true }),
    __metadata("design:type", Array)
], PreviewReportDto.prototype, "selectedMetricIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PreviewReportDto.prototype, "compare", void 0);
class CreateReportDto extends PreviewReportDto {
    forceNew;
}
exports.CreateReportDto = CreateReportDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateReportDto.prototype, "forceNew", void 0);
class ListReportsQueryDto extends pagination_1.CursorPaginationQueryDto {
    type;
    origin;
    status;
}
exports.ListReportsQueryDto = ListReportsQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(enums_1.REPORT_TYPES),
    __metadata("design:type", String)
], ListReportsQueryDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(enums_1.REPORT_ORIGINS),
    __metadata("design:type", String)
], ListReportsQueryDto.prototype, "origin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(enums_1.REPORT_STATUSES),
    __metadata("design:type", String)
], ListReportsQueryDto.prototype, "status", void 0);
class ReportIdParamDto {
    id;
}
exports.ReportIdParamDto = ReportIdParamDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 64),
    __metadata("design:type", String)
], ReportIdParamDto.prototype, "id", void 0);
//# sourceMappingURL=reports.dto.js.map