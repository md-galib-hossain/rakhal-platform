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
exports.FeedRequirementsQueryDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const toNumber = ({ value }) => value === undefined || value === null || value === '' ? value : Number(value);
class FeedRequirementsQueryDto {
    cattleId;
    cattleIds;
    date;
    weightKg;
    milkTargetL;
    milkFatPct;
    milkProteinPct;
    gestationDays;
    bcs;
    dim;
    animalType;
}
exports.FeedRequirementsQueryDto = FeedRequirementsQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], FeedRequirementsQueryDto.prototype, "cattleId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => typeof value === 'string'
        ? value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : value),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(500),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], FeedRequirementsQueryDto.prototype, "cattleIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], FeedRequirementsQueryDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => !o.cattleId && !o.cattleIds),
    (0, class_transformer_1.Transform)(toNumber),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(2000),
    __metadata("design:type", Number)
], FeedRequirementsQueryDto.prototype, "weightKg", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => !o.cattleId && !o.cattleIds),
    (0, class_transformer_1.Transform)(toNumber),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], FeedRequirementsQueryDto.prototype, "milkTargetL", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(toNumber),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(15),
    __metadata("design:type", Number)
], FeedRequirementsQueryDto.prototype, "milkFatPct", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(toNumber),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(10),
    __metadata("design:type", Number)
], FeedRequirementsQueryDto.prototype, "milkProteinPct", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(toNumber),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(305),
    __metadata("design:type", Number)
], FeedRequirementsQueryDto.prototype, "gestationDays", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(toNumber),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(5),
    __metadata("design:type", Number)
], FeedRequirementsQueryDto.prototype, "bcs", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(toNumber),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(999),
    __metadata("design:type", Number)
], FeedRequirementsQueryDto.prototype, "dim", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['COW', 'HEIFER', 'DRY']),
    __metadata("design:type", String)
], FeedRequirementsQueryDto.prototype, "animalType", void 0);
//# sourceMappingURL=feed-requirements-query.dto.js.map