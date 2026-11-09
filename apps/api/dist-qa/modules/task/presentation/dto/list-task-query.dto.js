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
exports.ListTaskQueryDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const pagination_1 = require("src/common/pagination");
const dto_1 = require("src/common/dto");
class ListTaskQueryDto extends pagination_1.CursorPaginationQueryDto {
    filter;
    kind;
    status;
    recurring;
    category;
    priority;
    search;
    cattleId;
    dueFrom;
    dueTo;
}
exports.ListTaskQueryDto = ListTaskQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsIn)(['my_tasks', 'all', 'overdue', 'upcoming', 'blocked']),
    __metadata("design:type", String)
], ListTaskQueryDto.prototype, "filter", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsIn)(['task', 'reminder']),
    __metadata("design:type", String)
], ListTaskQueryDto.prototype, "kind", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => typeof value === 'string'
        ? value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : value),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(7),
    (0, class_validator_1.IsEnum)(client_1.TaskStatus, { each: true }),
    __metadata("design:type", Array)
], ListTaskQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.toBoolean),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ListTaskQueryDto.prototype, "recurring", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.TaskCategory),
    __metadata("design:type", String)
], ListTaskQueryDto.prototype, "category", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.TaskPriority),
    __metadata("design:type", String)
], ListTaskQueryDto.prototype, "priority", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListTaskQueryDto.prototype, "search", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListTaskQueryDto.prototype, "cattleId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], ListTaskQueryDto.prototype, "dueFrom", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], ListTaskQueryDto.prototype, "dueTo", void 0);
//# sourceMappingURL=list-task-query.dto.js.map