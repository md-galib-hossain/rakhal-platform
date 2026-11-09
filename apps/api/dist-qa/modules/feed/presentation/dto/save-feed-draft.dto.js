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
exports.SaveFeedDraftDto = exports.FeedDraftEntryDto = exports.FeedEntryLineDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const dto_1 = require("src/common/dto");
class FeedEntryLineDto {
    planLineId;
    sourceType;
    feedItemId;
    feedStockId;
    offeredKg;
    refusalKg;
}
exports.FeedEntryLineDto = FeedEntryLineDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], FeedEntryLineDto.prototype, "planLineId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.FeedGridSourceType),
    __metadata("design:type", String)
], FeedEntryLineDto.prototype, "sourceType", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.sourceType === 'FEED_ITEM'),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], FeedEntryLineDto.prototype, "feedItemId", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.sourceType === 'FEED_STOCK'),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], FeedEntryLineDto.prototype, "feedStockId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(300, { message: 'offeredKg must not exceed 300 kg' }),
    __metadata("design:type", Number)
], FeedEntryLineDto.prototype, "offeredKg", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(300, { message: 'refusalKg must not exceed 300 kg' }),
    __metadata("design:type", Number)
], FeedEntryLineDto.prototype, "refusalKg", void 0);
class FeedDraftEntryDto {
    cattleId;
    offeredKg;
    lines;
    refusalKg;
    sourceType;
    feedItemId;
    feedStockId;
}
exports.FeedDraftEntryDto = FeedDraftEntryDto;
__decorate([
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], FeedDraftEntryDto.prototype, "cattleId", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => !o.lines),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(300, { message: 'offeredKg must not exceed 300 kg' }),
    __metadata("design:type", Number)
], FeedDraftEntryDto.prototype, "offeredKg", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(30),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => FeedEntryLineDto),
    __metadata("design:type", Array)
], FeedDraftEntryDto.prototype, "lines", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(300, { message: 'refusalKg must not exceed 300 kg' }),
    __metadata("design:type", Number)
], FeedDraftEntryDto.prototype, "refusalKg", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.FeedGridSourceType),
    __metadata("design:type", String)
], FeedDraftEntryDto.prototype, "sourceType", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.sourceType === 'FEED_ITEM'),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], FeedDraftEntryDto.prototype, "feedItemId", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.sourceType === 'FEED_STOCK'),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], FeedDraftEntryDto.prototype, "feedStockId", void 0);
class SaveFeedDraftDto {
    date;
    sourceType;
    feedItemId;
    feedStockId;
    entries;
}
exports.SaveFeedDraftDto = SaveFeedDraftDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], SaveFeedDraftDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.FeedGridSourceType),
    __metadata("design:type", String)
], SaveFeedDraftDto.prototype, "sourceType", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.sourceType === 'FEED_ITEM'),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveFeedDraftDto.prototype, "feedItemId", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.sourceType === 'FEED_STOCK'),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveFeedDraftDto.prototype, "feedStockId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => FeedDraftEntryDto),
    __metadata("design:type", Array)
], SaveFeedDraftDto.prototype, "entries", void 0);
//# sourceMappingURL=save-feed-draft.dto.js.map