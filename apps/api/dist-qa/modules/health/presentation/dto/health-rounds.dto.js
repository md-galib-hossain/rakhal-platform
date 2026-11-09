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
exports.UndoReasonDto = exports.AddRoundAnimalsDto = exports.RoundGridQueryDto = exports.RoundsQueryDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dto_1 = require("src/common/dto");
const pagination_1 = require("src/common/pagination");
const common_dto_1 = require("./common.dto");
class RoundsQueryDto extends pagination_1.CursorPaginationQueryDto {
    status;
    kind;
    search;
    healthPlanId;
}
exports.RoundsQueryDto = RoundsQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['RUNNING', 'FINISHED']),
    __metadata("design:type", String)
], RoundsQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['TREATMENT', 'PREVENTION', 'BREEDING']),
    __metadata("design:type", String)
], RoundsQueryDto.prototype, "kind", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RoundsQueryDto.prototype, "search", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RoundsQueryDto.prototype, "healthPlanId", void 0);
class RoundGridQueryDto extends pagination_1.CursorPaginationQueryDto {
    dueOnly;
}
exports.RoundGridQueryDto = RoundGridQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.toBoolean),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RoundGridQueryDto.prototype, "dueOnly", void 0);
class AddRoundAnimalsDto {
    cattleIds;
}
exports.AddRoundAnimalsDto = AddRoundAnimalsDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayNotEmpty)(),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], AddRoundAnimalsDto.prototype, "cattleIds", void 0);
class UndoReasonDto {
    reason;
}
exports.UndoReasonDto = UndoReasonDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(common_dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UndoReasonDto.prototype, "reason", void 0);
//# sourceMappingURL=health-rounds.dto.js.map