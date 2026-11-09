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
exports.StatementQueryDto = exports.DispatchQueryDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const pagination_1 = require("src/common/pagination");
const dto_1 = require("src/common/dto");
const DISPATCH_STATUSES = [
    'PENDING',
    'DELIVERED',
    'CANCELLED',
];
class DispatchQueryDto extends pagination_1.CursorPaginationQueryDto {
    buyerId;
    from;
    to;
    status;
}
exports.DispatchQueryDto = DispatchQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DispatchQueryDto.prototype, "buyerId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], DispatchQueryDto.prototype, "from", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], DispatchQueryDto.prototype, "to", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsIn)(DISPATCH_STATUSES),
    __metadata("design:type", String)
], DispatchQueryDto.prototype, "status", void 0);
class StatementQueryDto {
    month;
}
exports.StatementQueryDto = StatementQueryDto;
__decorate([
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}$/, { message: 'month must be in YYYY-MM format' }),
    __metadata("design:type", String)
], StatementQueryDto.prototype, "month", void 0);
//# sourceMappingURL=dispatch-query.dto.js.map