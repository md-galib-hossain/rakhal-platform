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
exports.ListInstanceQueryDto = exports.ListProtocolQueryDto = exports.UpdateProtocolDto = exports.CreateProtocolDto = exports.ProtocolStepDto = exports.CloseInstanceDto = exports.RecordOutcomeDto = exports.RecordAiDto = exports.ApplyProtocolDto = exports.StepScheduleOverrideDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const dto_1 = require("src/common/dto");
const pagination_1 = require("src/common/pagination");
class StepScheduleOverrideDto {
    dayNumber;
    stepId;
    dueAt;
}
exports.StepScheduleOverrideDto = StepScheduleOverrideDto;
__decorate([
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], StepScheduleOverrideDto.prototype, "dayNumber", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], StepScheduleOverrideDto.prototype, "stepId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], StepScheduleOverrideDto.prototype, "dueAt", void 0);
class ApplyProtocolDto {
    protocolId;
    cattleIds;
    startDate;
    stepOverrides;
}
exports.ApplyProtocolDto = ApplyProtocolDto;
__decorate([
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ApplyProtocolDto.prototype, "protocolId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayNotEmpty)(),
    (0, class_validator_1.ArrayUnique)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], ApplyProtocolDto.prototype, "cattleIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ApplyProtocolDto.prototype, "startDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => StepScheduleOverrideDto),
    __metadata("design:type", Array)
], ApplyProtocolDto.prototype, "stepOverrides", void 0);
class RecordAiDto {
    semenBatchId;
    inseminator;
    aiDate;
    notes;
}
exports.RecordAiDto = RecordAiDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RecordAiDto.prototype, "semenBatchId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], RecordAiDto.prototype, "inseminator", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], RecordAiDto.prototype, "aiDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    __metadata("design:type", String)
], RecordAiDto.prototype, "notes", void 0);
class RecordOutcomeDto {
    outcome;
    notes;
}
exports.RecordOutcomeDto = RecordOutcomeDto;
__decorate([
    (0, class_validator_1.IsIn)(['PREGNANT', 'OPEN', 'PREGNANCY_LOSS']),
    __metadata("design:type", String)
], RecordOutcomeDto.prototype, "outcome", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    __metadata("design:type", String)
], RecordOutcomeDto.prototype, "notes", void 0);
class CloseInstanceDto {
    status;
    reason;
}
exports.CloseInstanceDto = CloseInstanceDto;
__decorate([
    (0, class_validator_1.IsIn)(['CANCELLED', 'FAILED']),
    __metadata("design:type", String)
], CloseInstanceDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    __metadata("design:type", String)
], CloseInstanceDto.prototype, "reason", void 0);
class ProtocolStepDto {
    dayNumber;
    title;
    stepType;
    instruction;
    isRequired;
}
exports.ProtocolStepDto = ProtocolStepDto;
__decorate([
    (0, class_transformer_1.Transform)(({ value }) => Number(value)),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ProtocolStepDto.prototype, "dayNumber", void 0);
__decorate([
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], ProtocolStepDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.ReproStepType),
    __metadata("design:type", String)
], ProtocolStepDto.prototype, "stepType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], ProtocolStepDto.prototype, "instruction", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ProtocolStepDto.prototype, "isRequired", void 0);
class CreateProtocolDto {
    name;
    description;
    steps;
}
exports.CreateProtocolDto = CreateProtocolDto;
__decorate([
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreateProtocolDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], CreateProtocolDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayNotEmpty)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ProtocolStepDto),
    __metadata("design:type", Array)
], CreateProtocolDto.prototype, "steps", void 0);
class UpdateProtocolDto {
    name;
    description;
    steps;
}
exports.UpdateProtocolDto = UpdateProtocolDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], UpdateProtocolDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], UpdateProtocolDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayNotEmpty)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ProtocolStepDto),
    __metadata("design:type", Array)
], UpdateProtocolDto.prototype, "steps", void 0);
class ListProtocolQueryDto extends pagination_1.CursorPaginationQueryDto {
}
exports.ListProtocolQueryDto = ListProtocolQueryDto;
class ListInstanceQueryDto extends pagination_1.CursorPaginationQueryDto {
    protocolId;
    cattleId;
    status;
}
exports.ListInstanceQueryDto = ListInstanceQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListInstanceQueryDto.prototype, "protocolId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(dto_1.trimString),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListInstanceQueryDto.prototype, "cattleId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([
        'DRAFT',
        'SCHEDULED',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED',
        'FAILED',
    ]),
    __metadata("design:type", String)
], ListInstanceQueryDto.prototype, "status", void 0);
//# sourceMappingURL=protocol.dto.js.map