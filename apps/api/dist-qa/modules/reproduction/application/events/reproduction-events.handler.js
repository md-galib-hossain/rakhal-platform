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
exports.ReproductionEventHandler = void 0;
const common_1 = require("@nestjs/common");
const parse_payload_1 = require("src/modules/animal-events/application/parse-payload");
const event_handler_1 = require("src/modules/animal-events/application/event-handler");
const create_abortion_event_dto_1 = require("../../presentation/dto/create-abortion-event.dto");
const create_breeding_event_dto_1 = require("../../presentation/dto/create-breeding-event.dto");
const create_calving_event_dto_1 = require("../../presentation/dto/create-calving-event.dto");
const create_dry_off_dto_1 = require("../../presentation/dto/create-dry-off.dto");
const create_heat_event_dto_1 = require("../../presentation/dto/create-heat-event.dto");
const create_pregnancy_diagnosis_dto_1 = require("../../presentation/dto/create-pregnancy-diagnosis.dto");
const reproduction_service_1 = require("../services/reproduction.service");
const reproduction_edit_service_1 = require("../services/reproduction-edit.service");
const reproduction_derivation_service_1 = require("../services/reproduction-derivation.service");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
let ReproductionEventHandler = class ReproductionEventHandler {
    repro;
    registry;
    edits;
    derivation;
    prisma;
    constructor(repro, registry, edits, derivation, prisma) {
        this.repro = repro;
        this.registry = registry;
        this.edits = edits;
        this.derivation = derivation;
        this.prisma = prisma;
    }
    onModuleInit() {
        this.registry.register(['HEAT', 'BREEDING', 'PREG_CHECK', 'CALVING', 'ABORTION', 'DRY_OFF'], this);
        this.registry.onChange((farmId, cattleId) => this.derivation.refreshDerivedState(farmId, cattleId));
    }
    async voidEvent(type, i) {
        if (type !== 'BREEDING')
            return false;
        const b = await this.prisma.breedingEvent.findFirst({
            where: { animalEventId: i.animalEventId },
            select: { id: true },
        });
        if (!b)
            return false;
        await this.edits.voidBreedingEvent(i.farmId, i.userId, b.id, {
            reason: i.reason,
        });
        return true;
    }
    async handle(type, i) {
        const at = i.eventAt.toISOString();
        const base = {
            ...i.payload,
            cattleId: i.cattleId,
        };
        if (i.notes && base.notes === undefined)
            base.notes = i.notes;
        switch (type) {
            case 'HEAT': {
                const dto = await (0, parse_payload_1.parsePayload)(create_heat_event_dto_1.CreateHeatEventDto, {
                    ...base,
                    heatDateTime: at,
                });
                return {
                    detail: await this.repro.createHeatEvent(i.farmId, dto, undefined, i.userId),
                };
            }
            case 'BREEDING': {
                const raw = { ...base, breedingDate: at };
                let headerData;
                if (i.provenance === 'HISTORICAL') {
                    headerData = {
                        historyCost: raw.serviceCost ?? null,
                        historySemen: raw.sireNameOrCode ?? null,
                    };
                    raw.semenSource = 'EXTERNAL';
                    delete raw.serviceProviderId;
                    delete raw.semenBatchId;
                    delete raw.paymentMethod;
                    raw.serviceCost = 0;
                }
                const dto = await (0, parse_payload_1.parsePayload)(create_breeding_event_dto_1.CreateBreedingEventDto, raw);
                const detail = await this.repro.createBreedingEvent(i.farmId, i.userId, dto);
                return { detail, headerData };
            }
            case 'PREG_CHECK': {
                const dto = await (0, parse_payload_1.parsePayload)(create_pregnancy_diagnosis_dto_1.CreatePregnancyDiagnosisDto, {
                    result: 'PREGNANT',
                    diagnosisMethod: 'PALPATION',
                    ...base,
                    diagnosisDate: at,
                });
                return {
                    detail: await this.repro.createPregnancyDiagnosis(i.farmId, i.userId, dto),
                };
            }
            case 'CALVING': {
                const dto = await (0, parse_payload_1.parsePayload)(create_calving_event_dto_1.CreateCalvingEventDto, {
                    ...base,
                    calvingDate: at,
                });
                return {
                    detail: await this.repro.createCalvingEvent(i.farmId, i.userId, dto),
                };
            }
            case 'ABORTION': {
                const dto = await (0, parse_payload_1.parsePayload)(create_abortion_event_dto_1.CreateAbortionEventDto, {
                    ...base,
                    abortionDate: at,
                });
                return {
                    detail: await this.repro.createAbortionEvent(i.farmId, dto, i.userId),
                };
            }
            default: {
                const rest = { ...base };
                delete rest.cattleId;
                const dto = await (0, parse_payload_1.parsePayload)(create_dry_off_dto_1.CreateDryOffDto, {
                    ...rest,
                    dryOffDate: at,
                });
                return {
                    detail: await this.repro.recordDryOff(i.farmId, i.cattleId, dto, i.userId),
                };
            }
        }
    }
};
exports.ReproductionEventHandler = ReproductionEventHandler;
exports.ReproductionEventHandler = ReproductionEventHandler = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [reproduction_service_1.ReproductionService,
        event_handler_1.EventHandlerRegistry,
        reproduction_edit_service_1.ReproductionEditService,
        reproduction_derivation_service_1.ReproductionDerivationService,
        prisma_service_1.PrismaService])
], ReproductionEventHandler);
//# sourceMappingURL=reproduction-events.handler.js.map