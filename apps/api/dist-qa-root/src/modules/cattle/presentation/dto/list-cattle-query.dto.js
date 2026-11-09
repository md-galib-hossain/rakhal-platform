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
exports.ListCattleQueryDto = exports.HEALTH_STATUS_FILTERS = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const pagination_1 = require("src/common/pagination");
const categories_1 = require("src/modules/animal-events/domain/eligibility/categories");
const dto_1 = require("src/common/dto");
const animal_category_1 = require("../../domain/animal-category");
const animal_upcoming_events_1 = require("../../domain/animal-upcoming-events");
const lifecycle_bands_1 = require("../../domain/lifecycle-bands");
exports.HEALTH_STATUS_FILTERS = [
    'HEALTHY',
    'SICK',
    'IN_TREATMENT',
    'WITHHOLDING',
    'QUARANTINE',
];
class ListCattleQueryDto extends pagination_1.CursorPaginationQueryDto {
    search;
    breedId;
    gender;
    status;
    productionStatus;
    reproductiveStatus;
    animalCategory;
    category;
    healthStatus;
    lifecycleSubStage;
    dueFilter;
    shedId;
    animalGroupId;
    includeDeleted = false;
}
exports.ListCattleQueryDto = ListCattleQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListCattleQueryDto.prototype, "search", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListCattleQueryDto.prototype, "breedId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.CattleGender),
    __metadata("design:type", String)
], ListCattleQueryDto.prototype, "gender", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.HerdStatus),
    __metadata("design:type", String)
], ListCattleQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ProductionStatus),
    __metadata("design:type", String)
], ListCattleQueryDto.prototype, "productionStatus", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ReproductionState),
    __metadata("design:type", String)
], ListCattleQueryDto.prototype, "reproductiveStatus", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsIn)(animal_category_1.ANIMAL_CATEGORIES),
    __metadata("design:type", String)
], ListCattleQueryDto.prototype, "animalCategory", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value),
    (0, class_validator_1.IsIn)(categories_1.CATTLE_CATEGORIES),
    __metadata("design:type", String)
], ListCattleQueryDto.prototype, "category", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsIn)(exports.HEALTH_STATUS_FILTERS),
    __metadata("design:type", String)
], ListCattleQueryDto.prototype, "healthStatus", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsIn)(lifecycle_bands_1.LIFECYCLE_SUB_STAGES),
    __metadata("design:type", String)
], ListCattleQueryDto.prototype, "lifecycleSubStage", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsIn)(animal_upcoming_events_1.DUE_FILTERS),
    __metadata("design:type", String)
], ListCattleQueryDto.prototype, "dueFilter", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListCattleQueryDto.prototype, "shedId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListCattleQueryDto.prototype, "animalGroupId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.toBoolean),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Object)
], ListCattleQueryDto.prototype, "includeDeleted", void 0);
//# sourceMappingURL=list-cattle-query.dto.js.map