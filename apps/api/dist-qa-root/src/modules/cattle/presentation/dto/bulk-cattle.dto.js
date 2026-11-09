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
exports.BulkCattleDto = exports.BulkCattlePayloadDto = exports.BULK_DISPOSE_TYPES = exports.BULK_ACTIONS = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
exports.BULK_ACTIONS = [
    'change_shed',
    'mark_sold',
    'dispose',
    'export',
];
exports.BULK_DISPOSE_TYPES = ['SALE', 'CULL', 'DEATH'];
class BulkCattlePayloadDto {
    shedId;
    type;
    reason;
    date;
}
exports.BulkCattlePayloadDto = BulkCattlePayloadDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BulkCattlePayloadDto.prototype, "shedId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.BULK_DISPOSE_TYPES),
    __metadata("design:type", String)
], BulkCattlePayloadDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BulkCattlePayloadDto.prototype, "reason", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], BulkCattlePayloadDto.prototype, "date", void 0);
class BulkCattleDto {
    cattleIds;
    action;
    payload;
}
exports.BulkCattleDto = BulkCattleDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayNotEmpty)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], BulkCattleDto.prototype, "cattleIds", void 0);
__decorate([
    (0, class_validator_1.IsIn)(exports.BULK_ACTIONS),
    __metadata("design:type", String)
], BulkCattleDto.prototype, "action", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => BulkCattlePayloadDto),
    __metadata("design:type", BulkCattlePayloadDto)
], BulkCattleDto.prototype, "payload", void 0);
//# sourceMappingURL=bulk-cattle.dto.js.map