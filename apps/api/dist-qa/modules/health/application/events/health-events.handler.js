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
exports.HealthEventHandler = void 0;
const common_1 = require("@nestjs/common");
const exception_codes_enum_1 = require("src/common/exceptions/exception-codes.enum");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const parse_payload_1 = require("src/modules/animal-events/application/parse-payload");
const event_handler_1 = require("src/modules/animal-events/application/event-handler");
const create_health_case_dto_1 = require("../../presentation/dto/create-health-case.dto");
const case_actions_dto_1 = require("../../presentation/dto/case-actions.dto");
const health_service_1 = require("../services/health.service");
const OPEN_STATUSES = ['ACTIVE', 'IMPROVING', 'WORSENING', 'STABLE'];
let HealthEventHandler = class HealthEventHandler {
    health;
    prisma;
    registry;
    constructor(health, prisma, registry) {
        this.health = health;
        this.prisma = prisma;
        this.registry = registry;
    }
    onModuleInit() {
        this.registry.register(['ILLNESS', 'TREATMENT', 'VACCINATION', 'DEWORMING'], this);
    }
    openCase(cattleId, condition) {
        return this.prisma.healthCase.findFirst({
            where: {
                cattleId,
                deletedAt: null,
                status: { in: [...OPEN_STATUSES] },
                ...(condition ? { condition: condition } : {}),
            },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
        });
    }
    async voidEvent(type, i) {
        if (type === 'ILLNESS')
            return false;
        const log = await this.prisma.treatmentLog.findFirst({
            where: { animalEventId: i.animalEventId },
            select: { id: true },
        });
        if (!log)
            return false;
        await this.health.voidTreatmentLog(i.farmId, i.userId, log.id, i.reason);
        return true;
    }
    async findingsFor(type, i) {
        if (type === 'ILLNESS') {
            const cond = typeof i.payload.condition === 'string'
                ? i.payload.condition
                : undefined;
            return (await this.openCase(i.cattleId, cond))
                ? ['OPEN_CASE_EXISTS']
                : [];
        }
        if (type === 'TREATMENT') {
            return (await this.openCase(i.cattleId)) ? [] : ['TREATMENT_NEW_CASE'];
        }
        return [];
    }
    async handle(type, i) {
        const at = i.eventAt.toISOString();
        const p = { ...i.payload };
        const headerData = {};
        if (p.nextDoseDays != null)
            headerData.nextDoseDays = p.nextDoseDays;
        delete p.nextDoseDays;
        if (type === 'ILLNESS') {
            const dto = await (0, parse_payload_1.parsePayload)(create_health_case_dto_1.CreateHealthCaseDto, {
                careType: 'CURATIVE',
                priority: p.severity ?? 'MEDIUM',
                note: i.notes,
                ...p,
                cattleId: i.cattleId,
                startDate: at,
            });
            const created = await this.health.createHealthCase(i.farmId, i.userId, dto);
            headerData.healthCaseId = created.id ?? null;
            return { detail: created, headerData };
        }
        if (i.provenance === 'HISTORICAL') {
            if (!p.medicineName && typeof p.medicineId === 'string') {
                const med = await this.prisma.medicine.findFirst({
                    where: { id: p.medicineId, farmId: i.farmId },
                    select: { name: true },
                });
                p.medicineName = med?.name;
            }
            headerData.historyCost = p.vetCost ?? null;
            p.outsideInventory = true;
            p.medicineName = p.medicineName ?? type.toLowerCase();
            delete p.medicineId;
            delete p.vetCost;
            delete p.financialAccountId;
        }
        if (type === 'TREATMENT') {
            const open = await this.openCase(i.cattleId);
            if (!open && i.provenance !== 'HISTORICAL' && !p.condition) {
                throw new common_1.BadRequestException({
                    code: exception_codes_enum_1.ExceptionCode.VALIDATION_ERROR,
                    message: 'A condition is required to record a treatment for an animal with no open health case',
                    details: { eventCode: 'CONDITION_REQUIRED', field: 'condition' },
                });
            }
            if (open) {
                const dto = await (0, parse_payload_1.parsePayload)(case_actions_dto_1.LogTreatmentDto, {
                    ...p,
                    notes: i.notes,
                    administeredAt: at,
                });
                return {
                    detail: await this.health.logTreatment(i.farmId, i.userId, open.id, dto),
                    headerData,
                };
            }
        }
        const dto = await (0, parse_payload_1.parsePayload)(case_actions_dto_1.RecordTreatmentDto, {
            ...p,
            cattleIds: [i.cattleId],
            treatedAt: at,
            notes: i.notes,
            careType: type === 'TREATMENT' ? 'CURATIVE' : 'PREVENTIVE',
            reason: p.reason ?? type.toLowerCase(),
        });
        return {
            detail: await this.health.recordTreatment(i.farmId, i.userId, dto),
            headerData,
        };
    }
};
exports.HealthEventHandler = HealthEventHandler;
exports.HealthEventHandler = HealthEventHandler = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [health_service_1.HealthService,
        prisma_service_1.PrismaService,
        event_handler_1.EventHandlerRegistry])
], HealthEventHandler);
//# sourceMappingURL=health-events.handler.js.map