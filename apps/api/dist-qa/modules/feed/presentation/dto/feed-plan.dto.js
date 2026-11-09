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
exports.PreviewPlanFitDto = exports.PreviewManualRequirementDto = exports.ListPlanAssignmentsQueryDto = exports.ArchiveFeedPlanQueryDto = exports.ApplyFeedPlanDto = exports.FeedPlanFitQueryDto = exports.ListFeedPlansQueryDto = exports.UpdateFeedPlanDto = exports.CreateFeedPlanDto = exports.FeedPlanLineDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const dto_1 = require("src/common/dto");
const pagination_1 = require("src/common/pagination");
class FeedPlanLineDto {
    lineType;
    feedItemId;
    concentrationId;
    kgPerDay;
}
exports.FeedPlanLineDto = FeedPlanLineDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.FeedPlanLineType),
    __metadata("design:type", String)
], FeedPlanLineDto.prototype, "lineType", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.lineType === 'FEED_ITEM'),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], FeedPlanLineDto.prototype, "feedItemId", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.lineType === 'PREPARED'),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], FeedPlanLineDto.prototype, "concentrationId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.01),
    (0, class_validator_1.Max)(500),
    __metadata("design:type", Number)
], FeedPlanLineDto.prototype, "kgPerDay", void 0);
const MAX_LINES = 30;
class CreateFeedPlanDto {
    name;
    kind;
    notes;
    madeForCattleId;
    madeForAnimalGroupId;
    lines;
}
exports.CreateFeedPlanDto = CreateFeedPlanDto;
__decorate([
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], CreateFeedPlanDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.FeedPlanKind),
    __metadata("design:type", String)
], CreateFeedPlanDto.prototype, "kind", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], CreateFeedPlanDto.prototype, "notes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateFeedPlanDto.prototype, "madeForCattleId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateFeedPlanDto.prototype, "madeForAnimalGroupId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(MAX_LINES),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => FeedPlanLineDto),
    __metadata("design:type", Array)
], CreateFeedPlanDto.prototype, "lines", void 0);
class UpdateFeedPlanDto {
    name;
    kind;
    notes;
    madeForCattleId;
    madeForAnimalGroupId;
    lines;
}
exports.UpdateFeedPlanDto = UpdateFeedPlanDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], UpdateFeedPlanDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.FeedPlanKind),
    __metadata("design:type", String)
], UpdateFeedPlanDto.prototype, "kind", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], UpdateFeedPlanDto.prototype, "notes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpdateFeedPlanDto.prototype, "madeForCattleId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpdateFeedPlanDto.prototype, "madeForAnimalGroupId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(MAX_LINES),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => FeedPlanLineDto),
    __metadata("design:type", Array)
], UpdateFeedPlanDto.prototype, "lines", void 0);
class ListFeedPlansQueryDto extends pagination_1.CursorPaginationQueryDto {
    includeArchived = false;
    search;
    kind;
}
exports.ListFeedPlansQueryDto = ListFeedPlansQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.toBoolean),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Object)
], ListFeedPlansQueryDto.prototype, "includeArchived", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], ListFeedPlansQueryDto.prototype, "search", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.FeedPlanKind),
    __metadata("design:type", String)
], ListFeedPlansQueryDto.prototype, "kind", void 0);
class FeedPlanFitQueryDto {
    cattleIds;
    date;
}
exports.FeedPlanFitQueryDto = FeedPlanFitQueryDto;
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
], FeedPlanFitQueryDto.prototype, "cattleIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], FeedPlanFitQueryDto.prototype, "date", void 0);
class ApplyFeedPlanDto {
    targetType;
    cattleIds;
    animalGroupId;
}
exports.ApplyFeedPlanDto = ApplyFeedPlanDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.FeedPlanTarget),
    __metadata("design:type", String)
], ApplyFeedPlanDto.prototype, "targetType", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.targetType === 'INDIVIDUAL'),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(500),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.IsNotEmpty)({ each: true }),
    __metadata("design:type", Array)
], ApplyFeedPlanDto.prototype, "cattleIds", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.targetType === 'GROUP'),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ApplyFeedPlanDto.prototype, "animalGroupId", void 0);
class ArchiveFeedPlanQueryDto {
    removeAssignments = false;
}
exports.ArchiveFeedPlanQueryDto = ArchiveFeedPlanQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.toBoolean),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Object)
], ArchiveFeedPlanQueryDto.prototype, "removeAssignments", void 0);
class ListPlanAssignmentsQueryDto extends pagination_1.CursorPaginationQueryDto {
    cattleId;
    animalGroupId;
    planId;
    status;
}
exports.ListPlanAssignmentsQueryDto = ListPlanAssignmentsQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListPlanAssignmentsQueryDto.prototype, "cattleId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListPlanAssignmentsQueryDto.prototype, "animalGroupId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListPlanAssignmentsQueryDto.prototype, "planId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['ACTIVE', 'ENDED']),
    __metadata("design:type", String)
], ListPlanAssignmentsQueryDto.prototype, "status", void 0);
class PreviewManualRequirementDto {
    weightKg;
    milkTargetL;
    milkFatPct;
    milkProteinPct;
    gestationDays;
    bcs;
    dim;
    animalType;
}
exports.PreviewManualRequirementDto = PreviewManualRequirementDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(2000),
    __metadata("design:type", Number)
], PreviewManualRequirementDto.prototype, "weightKg", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], PreviewManualRequirementDto.prototype, "milkTargetL", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(15),
    __metadata("design:type", Number)
], PreviewManualRequirementDto.prototype, "milkFatPct", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(10),
    __metadata("design:type", Number)
], PreviewManualRequirementDto.prototype, "milkProteinPct", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(305),
    __metadata("design:type", Number)
], PreviewManualRequirementDto.prototype, "gestationDays", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(5),
    __metadata("design:type", Number)
], PreviewManualRequirementDto.prototype, "bcs", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(999),
    __metadata("design:type", Number)
], PreviewManualRequirementDto.prototype, "dim", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['COW', 'HEIFER', 'DRY']),
    __metadata("design:type", String)
], PreviewManualRequirementDto.prototype, "animalType", void 0);
class PreviewPlanFitDto {
    lines;
    cattleId;
    manual;
}
exports.PreviewPlanFitDto = PreviewPlanFitDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(MAX_LINES),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => FeedPlanLineDto),
    __metadata("design:type", Array)
], PreviewPlanFitDto.prototype, "lines", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], PreviewPlanFitDto.prototype, "cattleId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => PreviewManualRequirementDto),
    __metadata("design:type", PreviewManualRequirementDto)
], PreviewPlanFitDto.prototype, "manual", void 0);
//# sourceMappingURL=feed-plan.dto.js.map