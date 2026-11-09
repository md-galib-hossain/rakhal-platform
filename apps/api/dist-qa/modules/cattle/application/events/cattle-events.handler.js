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
exports.CattleEventHandler = void 0;
const common_1 = require("@nestjs/common");
const parse_payload_1 = require("src/modules/animal-events/application/parse-payload");
const event_handler_1 = require("src/modules/animal-events/application/event-handler");
const record_bcs_dto_1 = require("../../presentation/dto/record-bcs.dto");
const record_weight_dto_1 = require("../../presentation/dto/record-weight.dto");
const bcs_service_1 = require("../services/bcs.service");
const weight_service_1 = require("../services/weight.service");
let CattleEventHandler = class CattleEventHandler {
    weights;
    bcs;
    registry;
    constructor(weights, bcs, registry) {
        this.weights = weights;
        this.bcs = bcs;
        this.registry = registry;
    }
    onModuleInit() {
        this.registry.register(['WEIGHT', 'BCS'], this);
    }
    async handle(type, i) {
        const raw = {
            ...i.payload,
            date: i.eventAt.toISOString(),
            notes: i.notes ?? i.payload.notes,
        };
        if (type === 'WEIGHT') {
            const dto = await (0, parse_payload_1.parsePayload)(record_weight_dto_1.RecordWeightDto, raw);
            const res = await this.weights.recordWeight(i.farmId, i.userId, i.cattleId, dto);
            return { detail: res.record };
        }
        const dto = await (0, parse_payload_1.parsePayload)(record_bcs_dto_1.RecordBcsDto, raw);
        const res = await this.bcs.recordBcs(i.farmId, i.userId, i.cattleId, dto);
        return { detail: res.record };
    }
};
exports.CattleEventHandler = CattleEventHandler;
exports.CattleEventHandler = CattleEventHandler = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [weight_service_1.WeightService,
        bcs_service_1.BcsService,
        event_handler_1.EventHandlerRegistry])
], CattleEventHandler);
//# sourceMappingURL=cattle-events.handler.js.map