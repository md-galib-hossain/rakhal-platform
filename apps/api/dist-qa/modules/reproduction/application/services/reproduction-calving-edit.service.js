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
var ReproductionCalvingEditService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReproductionCalvingEditService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const aqr_service_1 = require("src/modules/activity/application/services/aqr.service");
const activity_log_service_1 = require("src/modules/activity/application/services/activity-log.service");
const calf_service_1 = require("src/modules/calf/application/services/calf.service");
const reproduction_derivation_service_1 = require("./reproduction-derivation.service");
let ReproductionCalvingEditService = ReproductionCalvingEditService_1 = class ReproductionCalvingEditService {
    prisma;
    derivation;
    calfService;
    aqrService;
    activityLog;
    log;
    constructor(prisma, derivation, calfService, aqrService, activityLog, logger) {
        this.prisma = prisma;
        this.derivation = derivation;
        this.calfService = calfService;
        this.aqrService = aqrService;
        this.activityLog = activityLog;
        this.log = logger.setContext(ReproductionCalvingEditService_1.name);
    }
    async editCalvingEvent(farmId, userId, id, dto) {
        const existing = await this.prisma.calvingEvent.findFirst({
            where: { id, cattle: { farmId } },
            include: { calfBirths: true },
        });
        if (!existing)
            throw new common_1.NotFoundException('Calving event not found');
        const newCattleId = dto.cattleId ?? existing.cattleId;
        if (dto.cattleId)
            await this.assertFemaleCattleInFarm(farmId, dto.cattleId);
        const newCalvingDate = dto.calvingDate
            ? new Date(dto.calvingDate)
            : undefined;
        const dateChanged = !!newCalvingDate &&
            newCalvingDate.getTime() !== existing.calvingDate.getTime();
        const pregnancy = existing.pregnancyId
            ? await this.prisma.pregnancy.findUnique({
                where: { id: existing.pregnancyId },
            })
            : null;
        await this.prisma.calvingEvent.update({
            where: { id },
            data: {
                cattleId: dto.cattleId,
                calvingDate: newCalvingDate,
                calvingEase: dto.calvingEase,
                placentaExpelled: dto.placentaExpelled,
                retainedPlacenta: dto.retainedPlacenta,
                complications: dto.complications,
                notes: dto.notes,
            },
        });
        if (dateChanged && newCalvingDate) {
            await this.prisma.lactation.updateMany({
                where: { calvingEventId: id },
                data: { startDate: newCalvingDate },
            });
            const calfIds = existing.calfBirths
                .map((b) => b.calfId)
                .filter((cid) => cid !== null);
            if (calfIds.length > 0) {
                await this.prisma.cattle.updateMany({
                    where: { id: { in: calfIds } },
                    data: { dateOfBirth: newCalvingDate },
                });
            }
            if (pregnancy) {
                await this.prisma.pregnancy.update({
                    where: { id: pregnancy.id },
                    data: {
                        actualCalvingDate: newCalvingDate,
                        gestationDays: pregnancy.conceptionDate
                            ? this.daysBetween(pregnancy.conceptionDate, newCalvingDate)
                            : null,
                    },
                });
            }
            const deltaMs = newCalvingDate.getTime() - existing.calvingDate.getTime();
            const tasks = await this.prisma.task.findMany({
                where: {
                    farmId,
                    sourceEventType: 'CALVING_EVENT',
                    sourceEventId: id,
                    status: { not: client_1.TaskStatus.COMPLETED },
                },
                select: { id: true, dueAt: true },
            });
            await Promise.all(tasks.map((t) => this.prisma.task.update({
                where: { id: t.id },
                data: { dueAt: new Date(t.dueAt.getTime() + deltaMs) },
            })));
        }
        const addedCalfIds = [];
        const effectiveCalvingDate = newCalvingDate ?? existing.calvingDate;
        const bull = pregnancy?.breedingEventId
            ? await this.prisma.breedingEvent.findUnique({
                where: { id: pregnancy.breedingEventId },
                select: { bullId: true },
            })
            : null;
        for (const calf of dto.addCalves ?? []) {
            let calfId;
            if (calf.status === client_1.CalfBirthStatus.ALIVE) {
                if (!calf.tagNumber) {
                    throw new common_1.BadRequestException('Alive calves must include tagNumber for cattle registration');
                }
                const createdCalf = await this.prisma.cattle.create({
                    data: {
                        farmId,
                        name: calf.name,
                        tagNumber: calf.tagNumber,
                        gender: calf.gender,
                        dateOfBirth: effectiveCalvingDate,
                        herdStatus: client_1.HerdStatus.ACTIVE,
                        motherId: newCattleId,
                        fatherId: bull?.bullId ?? undefined,
                        sourceType: client_1.CattleSourceType.BORN,
                        createdBy: userId,
                    },
                });
                calfId = createdCalf.id;
                addedCalfIds.push(calfId);
            }
            await this.prisma.calfBirth.create({
                data: {
                    calvingEventId: id,
                    calfId,
                    gender: calf.gender,
                    birthWeight: calf.birthWeight,
                    status: calf.status,
                },
            });
        }
        for (const calfId of addedCalfIds) {
            const calf = await this.prisma.cattle.findUniqueOrThrow({
                where: { id: calfId },
            });
            await this.aqrService.applyEvent(farmId, calfId, 'animal_registered', {
                actorId: userId,
                actionDetails: `Calf [${calf.tagNumber}] added to calving record.`,
            });
            await this.calfService.scheduleCareReminders({
                farmId,
                createdBy: userId,
                calfId,
                birthDate: effectiveCalvingDate,
                gender: calf.gender,
                sourceEventId: id,
            });
        }
        for (const calfBirthId of dto.removeCalfBirthIds ?? []) {
            const birth = existing.calfBirths.find((b) => b.id === calfBirthId);
            if (!birth) {
                throw new common_1.BadRequestException(`CalfBirth ${calfBirthId} does not belong to this calving event`);
            }
            if (birth.calfId) {
                const calf = await this.assertCalfHasNoOwnRecords(birth.calfId);
                await this.prisma.cattle.update({
                    where: { id: birth.calfId },
                    data: { deletedAt: new Date() },
                });
                const registerLog = await this.prisma.activityLog.findFirst({
                    where: {
                        farmId,
                        relatedCattleId: birth.calfId,
                        eventTitle: 'Animal Registered',
                        aqrImpact: { not: null },
                    },
                    orderBy: { timestamp: 'desc' },
                });
                if (registerLog) {
                    await this.aqrService.reverseEvent(farmId, birth.calfId, registerLog.id, {
                        actorId: userId,
                        actionDetails: `Calf [${calf.tagNumber}] removed from calving record.`,
                    });
                }
            }
            await this.prisma.calfBirth.delete({ where: { id: calfBirthId } });
        }
        const finalCount = await this.prisma.calfBirth.count({
            where: { calvingEventId: id },
        });
        await this.prisma.calvingEvent.update({
            where: { id },
            data: { calfCount: finalCount },
        });
        await this.refreshBoth(farmId, existing.cattleId, newCattleId);
        await this.recordEdit(farmId, userId, existing, dto, newCattleId);
        this.log.info('Calving event edited', { calvingEventId: id, farmId });
        return this.prisma.calvingEvent.findUniqueOrThrow({
            where: { id },
            include: { calfBirths: { include: { calf: true } }, lactations: true },
        });
    }
    async assertFemaleCattleInFarm(farmId, cattleId) {
        const cattle = await this.prisma.cattle.findFirst({
            where: { id: cattleId, farmId },
        });
        if (!cattle)
            throw new common_1.BadRequestException('Cattle must belong to this farm');
        if (cattle.gender !== client_1.CattleGender.FEMALE) {
            throw new common_1.BadRequestException('Reproduction records can only be edited onto female cattle');
        }
        return cattle;
    }
    async assertCalfHasNoOwnRecords(calfId) {
        const calf = await this.prisma.cattle.findUniqueOrThrow({
            where: { id: calfId },
        });
        const [weights, bcs, health, milk, offspring] = await Promise.all([
            this.prisma.weightRecord.count({ where: { cattleId: calfId } }),
            this.prisma.bodyConditionScore.count({ where: { cattleId: calfId } }),
            this.prisma.healthCase.count({ where: { cattleId: calfId } }),
            this.prisma.milkLogEntry.count({ where: { cattleId: calfId } }),
            this.prisma.cattle.count({
                where: { OR: [{ motherId: calfId }, { fatherId: calfId }] },
            }),
        ]);
        if (weights + bcs + health + milk + offspring > 0) {
            throw new common_1.ConflictException(`Cannot remove calf [${calf.tagNumber}] from this calving record — she has her own records (weights/BCS/health/milk/offspring). Archive her directly from Cattle instead.`);
        }
        return calf;
    }
    async refreshBoth(farmId, oldCattleId, newCattleId) {
        await this.derivation.refreshDerivedState(farmId, oldCattleId);
        if (newCattleId !== oldCattleId) {
            await this.derivation.refreshDerivedState(farmId, newCattleId);
        }
    }
    daysBetween(start, end) {
        return Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    }
    async recordEdit(farmId, userId, existing, dto, cattleId) {
        const changes = this.buildChanges(existing, dto);
        await this.activityLog.record({
            farmId,
            module: client_1.ActivityLogModule.BREEDING,
            eventTitle: 'Edited: Calving Event',
            actionDetails: changes.length > 0
                ? `Calving Event edited — ${changes.map((c) => `${c.key}: ${c.value}`).join('; ')}`
                : 'Calving Event edited (no field changes).',
            actorId: userId,
            relatedCattleId: cattleId,
            taggedValues: changes,
        });
    }
    buildChanges(existing, dto) {
        const existingRecord = existing;
        const changes = [];
        for (const [key, value] of Object.entries(dto)) {
            if (value === undefined)
                continue;
            changes.push({
                key,
                value: `${this.stringify(existingRecord[key])} → ${this.stringify(value)}`,
            });
        }
        return changes;
    }
    stringify(value) {
        if (value === null || value === undefined)
            return 'null';
        if (value instanceof Date)
            return value.toISOString();
        if (typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean') {
            return String(value);
        }
        return JSON.stringify(value);
    }
};
exports.ReproductionCalvingEditService = ReproductionCalvingEditService;
exports.ReproductionCalvingEditService = ReproductionCalvingEditService = ReproductionCalvingEditService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        reproduction_derivation_service_1.ReproductionDerivationService,
        calf_service_1.CalfService,
        aqr_service_1.AqrService,
        activity_log_service_1.ActivityLogService,
        logger_service_1.LoggerService])
], ReproductionCalvingEditService);
//# sourceMappingURL=reproduction-calving-edit.service.js.map