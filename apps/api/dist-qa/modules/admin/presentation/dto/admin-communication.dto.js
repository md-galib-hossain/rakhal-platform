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
exports.AdminBroadcastMessageDto = exports.AdminSendMessageDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dto_1 = require("src/common/dto");
class AdminSendMessageDto {
    title;
    message;
    link;
    channel;
}
exports.AdminSendMessageDto = AdminSendMessageDto;
__decorate([
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(5, { message: 'Title must be at least 5 characters' }),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], AdminSendMessageDto.prototype, "title", void 0);
__decorate([
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(10, { message: 'Message must be at least 10 characters' }),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], AdminSendMessageDto.prototype, "message", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], AdminSendMessageDto.prototype, "link", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['all', 'telegram', 'push']),
    __metadata("design:type", String)
], AdminSendMessageDto.prototype, "channel", void 0);
class AdminBroadcastMessageDto extends AdminSendMessageDto {
    targetAudience;
    targetUserIds;
}
exports.AdminBroadcastMessageDto = AdminBroadcastMessageDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['all', 'owners', 'pro_plan', 'with_telegram']),
    __metadata("design:type", String)
], AdminBroadcastMessageDto.prototype, "targetAudience", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], AdminBroadcastMessageDto.prototype, "targetUserIds", void 0);
//# sourceMappingURL=admin-communication.dto.js.map