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
exports.ConfirmFeedDraftDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const dto_1 = require("src/common/dto");
const save_feed_draft_dto_1 = require("./save-feed-draft.dto");
class ConfirmFeedDraftDto {
    date;
    sourceType;
    feedItemId;
    feedStockId;
    entries;
}
exports.ConfirmFeedDraftDto = ConfirmFeedDraftDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], ConfirmFeedDraftDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.FeedGridSourceType),
    __metadata("design:type", String)
], ConfirmFeedDraftDto.prototype, "sourceType", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.sourceType === 'FEED_ITEM'),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ConfirmFeedDraftDto.prototype, "feedItemId", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.sourceType === 'FEED_STOCK'),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ConfirmFeedDraftDto.prototype, "feedStockId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => save_feed_draft_dto_1.FeedDraftEntryDto),
    __metadata("design:type", Array)
], ConfirmFeedDraftDto.prototype, "entries", void 0);
//# sourceMappingURL=confirm-feed-draft.dto.js.map