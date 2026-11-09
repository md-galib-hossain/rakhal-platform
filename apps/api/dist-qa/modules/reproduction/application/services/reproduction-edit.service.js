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
var ReproductionEditService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReproductionEditService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const aqr_service_1 = require("src/modules/activity/application/services/aqr.service");
const activity_log_service_1 = require("src/modules/activity/application/services/activity-log.service");
const task_service_1 = require("src/modules/task/application/services/task.service");
const semen_service_1 = require("src/modules/inventory/application/services/semen.service");
const expense_service_1 = require("src/modules/purchasing/application/expense.service");
const farm_settings_service_1 = require("src/modules/farm-settings/farm-settings.service");
const lactation_dry_off_projection_1 = require("../../domain/lactation-dry-off-projection");
const reproduction_derivation_service_1 = require("./reproduction-derivation.service");
let ReproductionEditService = ReproductionEditService_1 = class ReproductionEditService {
    prisma;
    derivation;
    semenService;
    expenseService;
    taskService;
    aqrService;
    activityLog;
    farmSettings;
    log;
    constructor(prisma, derivation, semenService, expenseService, taskService, aqrService, activityLog, farmSettings, logger) {
        this.prisma = prisma;
        this.derivation = derivation;
        this.semenService = semenService;
        this.expenseService = expenseService;
        this.taskService = taskService;
        this.aqrService = aqrService;
        this.activityLog = activityLog;
        this.farmSettings = farmSettings;
        this.log = logger.setContext(ReproductionEditService_1.name);
    }
    async editHeatEvent(farmId, userId, id, dto) {
        const existing = await this.prisma.heatEvent.findFirst({
            where: { id, cattle: { farmId } },
        });
        if (!existing)
            throw new common_1.NotFoundException('Heat event not found');
        const newCattleId = dto.cattleId ?? existing.cattleId;
        if (dto.cattleId)
            await this.assertFemaleCattleInFarm(farmId, dto.cattleId);
        const updated = await this.prisma.heatEvent.update({
            where: { id },
            data: {
                cattleId: dto.cattleId,
                heatDateTime: dto.heatDateTime ? new Date(dto.heatDateTime) : undefined,
                detectionMethod: dto.detectionMethod,
                standingHeat: dto.standingHeat,
                mucusDischarge: dto.mucusDischarge,
                mountingBehavior: dto.mountingBehavior,
                restlessness: dto.restlessness,
                notes: dto.notes,
            },
        });
        await this.refreshBoth(farmId, existing.cattleId, newCattleId);
        await this.recordEdit(farmId, userId, 'Heat Event', existing, dto, newCattleId);
        this.log.info('Heat event edited', { heatEventId: id, farmId });
        return updated;
    }
    async cancelHeatEvent(farmId, userId, id, dto) {
        const existing = await this.prisma.heatEvent.findFirst({
            where: { id, cattle: { farmId } },
            include: { cattle: { select: { tagNumber: true } } },
        });
        if (!existing)
            throw new common_1.NotFoundException('Heat event not found');
        if (existing.resolvedByBreedingEventId ||
            existing.returnedFromBreedingEventId) {
            throw new common_1.BadRequestException(`This heat for [${existing.cattle.tagNumber}] is linked to a breeding and cannot be cancelled. Void or correct the breeding first.`);
        }
        await this.prisma.heatEvent.delete({ where: { id } });
        await this.derivation.refreshDerivedState(farmId, existing.cattleId);
        await this.activityLog.record({
            farmId,
            module: client_1.ActivityLogModule.BREEDING,
            eventTitle: 'Cancelled: Heat Event',
            actionDetails: `Heat for [${existing.cattle.tagNumber}] on ${existing.heatDateTime.toISOString()} cancelled${dto.reason ? ` - ${dto.reason}` : ''}`,
            actorId: userId,
            relatedCattleId: existing.cattleId,
            taggedValues: dto.reason ? [{ key: 'reason', value: dto.reason }] : [],
        });
        this.log.info('Heat event cancelled', { heatEventId: id, farmId });
        return { id, cancelled: true };
    }
    async editBreedingEvent(farmId, userId, id, dto) {
        const existing = await this.prisma.breedingEvent.findFirst({
            where: { id, cattle: { farmId } },
        });
        if (!existing)
            throw new common_1.NotFoundException('Breeding event not found');
        if (existing.voidedAt) {
            throw new common_1.BadRequestException('This breeding was voided and can no longer be edited.');
        }
        const newCattleId = dto.cattleId ?? existing.cattleId;
        if (dto.cattleId)
            await this.assertFemaleCattleInFarm(farmId, dto.cattleId);
        if (dto.bullId)
            await this.assertCattleInFarm(farmId, dto.bullId);
        const mergedMethod = dto.breedingMethod ?? existing.breedingMethod;
        const mergedSemenSource = dto.semenSource !== undefined ? dto.semenSource : existing.semenSource;
        const sourceChangedAwayFromInventory = dto.semenSource !== undefined &&
            dto.semenSource !== client_1.SemenSource.FARM_INVENTORY;
        const sourceChangedToInventory = dto.semenSource !== undefined &&
            dto.semenSource === client_1.SemenSource.FARM_INVENTORY;
        const mergedSemenBatchId = sourceChangedAwayFromInventory
            ? null
            : dto.semenBatchId !== undefined
                ? dto.semenBatchId
                : existing.semenBatchId;
        const mergedServiceProviderId = sourceChangedToInventory
            ? null
            : dto.serviceProviderId !== undefined
                ? dto.serviceProviderId
                : existing.serviceProviderId;
        if (mergedSemenSource &&
            mergedSemenSource !== client_1.SemenSource.FARM_INVENTORY &&
            mergedSemenBatchId) {
            throw new common_1.BadRequestException('semenBatchId is only valid when semenSource is FARM_INVENTORY');
        }
        if (mergedSemenSource === client_1.SemenSource.TECHNICIAN_SUPPLIED &&
            !mergedServiceProviderId) {
            throw new common_1.BadRequestException('serviceProviderId is required when semenSource is TECHNICIAN_SUPPLIED');
        }
        const serviceProvider = dto.serviceProviderId
            ? await this.assertServiceProviderInFarm(farmId, dto.serviceProviderId)
            : null;
        const newBreedingDate = dto.breedingDate
            ? new Date(dto.breedingDate)
            : existing.breedingDate;
        const pregnancyCheckDays = await this.farmSettings.reproPregnancyCheckDays(farmId);
        const hadStraw = existing.breedingMethod === client_1.BreedingMethod.AI &&
            existing.semenSource === client_1.SemenSource.FARM_INVENTORY &&
            !!existing.semenBatchId;
        const willHaveStraw = mergedMethod === client_1.BreedingMethod.AI &&
            mergedSemenSource === client_1.SemenSource.FARM_INVENTORY &&
            !!mergedSemenBatchId;
        const batchChanged = mergedSemenBatchId !== existing.semenBatchId;
        let inventorySemenType;
        let inventoryTargetSex;
        let inventoryBatch = null;
        if (mergedSemenSource === client_1.SemenSource.FARM_INVENTORY &&
            mergedSemenBatchId) {
            const batch = await this.prisma.semenBatch.findFirst({
                where: { id: mergedSemenBatchId, farmId },
                select: {
                    name: true,
                    semenType: true,
                    targetSex: true,
                    costPerUnit: true,
                },
            });
            inventorySemenType = batch?.semenType ?? null;
            inventoryTargetSex = batch?.targetSex ?? null;
            inventoryBatch = batch ?? null;
        }
        const costRelevantFieldsChanged = dto.breedingMethod !== undefined ||
            dto.semenSource !== undefined ||
            dto.semenBatchId !== undefined ||
            dto.serviceCost !== undefined ||
            dto.paymentMethod !== undefined ||
            dto.financialAccountId !== undefined;
        const mergedServiceCost = sourceChangedToInventory
            ? null
            : dto.serviceCost !== undefined
                ? dto.serviceCost
                : existing.serviceCost;
        const mergedFinancialAccountId = dto.financialAccountId;
        let resolvedCost = 0;
        let costEntityName;
        if (costRelevantFieldsChanged) {
            if (mergedMethod === client_1.BreedingMethod.AI) {
                if (mergedSemenSource === client_1.SemenSource.FARM_INVENTORY) {
                    if (inventoryBatch?.costPerUnit == null) {
                        throw new common_1.BadRequestException(`Semen batch [${inventoryBatch?.name ?? mergedSemenBatchId}] has no cost per straw set — set its cost before recording an AI event against it.`);
                    }
                    resolvedCost = inventoryBatch.costPerUnit;
                    costEntityName = inventoryBatch.name;
                }
                else {
                    if (mergedServiceCost == null) {
                        throw new common_1.BadRequestException('serviceCost is required for AI breeding when semen is not sourced from farm inventory');
                    }
                    resolvedCost = mergedServiceCost;
                    costEntityName =
                        serviceProvider?.name ??
                            dto.semenCompany ??
                            existing.semenCompany ??
                            'AI service';
                }
            }
            else {
                resolvedCost = mergedServiceCost ?? 0;
                costEntityName =
                    serviceProvider?.name ?? existing.semenCompany ?? 'Breeding service';
            }
        }
        let updated = await this.prisma.breedingEvent.update({
            where: { id },
            data: {
                cattleId: dto.cattleId,
                breedingDate: dto.breedingDate ? newBreedingDate : undefined,
                breedingMethod: dto.breedingMethod,
                bullId: dto.bullId,
                semenBatchId: sourceChangedAwayFromInventory ? null : dto.semenBatchId,
                inseminator: dto.inseminator,
                semenSource: dto.semenSource,
                serviceProviderId: sourceChangedToInventory
                    ? null
                    : dto.serviceProviderId,
                sireNameOrCode: sourceChangedToInventory ? null : dto.sireNameOrCode,
                sireBreed: sourceChangedToInventory ? null : dto.sireBreed,
                semenType: mergedSemenSource === client_1.SemenSource.FARM_INVENTORY
                    ? inventorySemenType
                    : sourceChangedToInventory
                        ? null
                        : dto.semenType,
                targetSex: mergedSemenSource === client_1.SemenSource.FARM_INVENTORY
                    ? inventoryTargetSex
                    : sourceChangedToInventory
                        ? null
                        : dto.targetSex,
                strawBatchCode: sourceChangedToInventory ? null : dto.strawBatchCode,
                semenCompany: sourceChangedToInventory ? null : dto.semenCompany,
                serviceCost: sourceChangedToInventory ? null : dto.serviceCost,
                paymentMethod: dto.paymentMethod,
                breedingNumber: dto.breedingNumber,
                expectedPregnancyCheckDate: dto.expectedPregnancyCheckDate
                    ? new Date(dto.expectedPregnancyCheckDate)
                    : dto.breedingDate
                        ? this.addDays(newBreedingDate, pregnancyCheckDays)
                        : undefined,
                notes: dto.notes,
            },
        });
        if (costRelevantFieldsChanged) {
            if (existing.financeTransactionId) {
                await this.expenseService.voidInventoryConsumption(farmId, existing.financeTransactionId, userId);
            }
            let newFinanceTransactionId = null;
            if (resolvedCost > 0) {
                if (mergedSemenSource === client_1.SemenSource.FARM_INVENTORY) {
                    const posted = await this.expenseService.recordInventoryConsumption(farmId, userId, {
                        category: client_1.ExpenseCategory.BREEDING,
                        description: `${costEntityName ?? 'Semen Straw'} — Breeding #${updated.breedingNumber} (${mergedMethod}) — edited`,
                        amount: resolvedCost,
                        expenseDate: newBreedingDate.toISOString(),
                        cattleId: newCattleId,
                    });
                    newFinanceTransactionId = posted.id;
                }
                else {
                    const posted = await this.expenseService.recordExpense(farmId, userId, {
                        category: client_1.ExpenseCategory.BREEDING,
                        description: `${costEntityName ?? 'Breeding service'} — Breeding #${updated.breedingNumber} (${mergedMethod}) — edited`,
                        amount: resolvedCost,
                        financialAccountId: await this.expenseService.resolveAccountId(farmId, userId, mergedFinancialAccountId),
                        expenseDate: newBreedingDate.toISOString(),
                        cattleId: newCattleId,
                    });
                    newFinanceTransactionId = posted.id;
                }
            }
            updated = await this.prisma.breedingEvent.update({
                where: { id },
                data: { financeTransactionId: newFinanceTransactionId },
            });
        }
        if (hadStraw && (!willHaveStraw || batchChanged) && existing.semenBatchId) {
            await this.semenService.restoreStraw(farmId, existing.semenBatchId, 1, 'Breeding event edited', id, userId);
        }
        if (willHaveStraw && (!hadStraw || batchChanged) && mergedSemenBatchId) {
            await this.semenService.decrementStraw(farmId, mergedSemenBatchId, 1, userId, id);
        }
        if (dto.breedingDate) {
            await this.taskService.rescheduleBySourceEvent(farmId, 'BREEDING_EVENT', id, updated.expectedPregnancyCheckDate ??
                this.addDays(newBreedingDate, pregnancyCheckDays));
            const linkedHeat = await this.prisma.heatEvent.findFirst({
                where: { resolvedByBreedingEventId: id },
            });
            if (linkedHeat) {
                await this.prisma.heatEvent.update({
                    where: { id: linkedHeat.id },
                    data: { resolvedAt: newBreedingDate },
                });
            }
        }
        if (dto.bullId && dto.bullId !== existing.bullId) {
            const pregnancies = await this.prisma.pregnancy.findMany({
                where: { breedingEventId: id },
                select: { id: true },
            });
            if (pregnancies.length > 0) {
                const calvings = await this.prisma.calvingEvent.findMany({
                    where: { pregnancyId: { in: pregnancies.map((p) => p.id) } },
                    select: { id: true },
                });
                if (calvings.length > 0) {
                    const calfBirths = await this.prisma.calfBirth.findMany({
                        where: {
                            calvingEventId: { in: calvings.map((c) => c.id) },
                            calfId: { not: null },
                        },
                        select: { calfId: true },
                    });
                    const calfIds = calfBirths
                        .map((b) => b.calfId)
                        .filter((cid) => cid !== null);
                    if (calfIds.length > 0) {
                        await this.prisma.cattle.updateMany({
                            where: { id: { in: calfIds } },
                            data: { fatherId: dto.bullId },
                        });
                    }
                }
            }
        }
        await this.refreshBoth(farmId, existing.cattleId, newCattleId);
        await this.recordEdit(farmId, userId, 'Breeding Event', existing, dto, newCattleId);
        this.log.info('Breeding event edited', { breedingEventId: id, farmId });
        return updated;
    }
    async voidBreedingEvent(farmId, userId, id, dto) {
        const existing = await this.prisma.breedingEvent.findFirst({
            where: { id, cattle: { farmId } },
            include: {
                cattle: { select: { tagNumber: true } },
                _count: { select: { diagnoses: true, pregnancies: true } },
            },
        });
        if (!existing)
            throw new common_1.NotFoundException('Breeding event not found');
        if (existing.voidedAt) {
            throw new common_1.BadRequestException('This breeding is already voided.');
        }
        const label = `Breeding #${existing.breedingNumber} for [${existing.cattle.tagNumber}]`;
        const blocked = () => {
            throw new common_1.BadRequestException(`${label} already has a follow-up (${existing.status}, ${existing._count.diagnoses} pregnancy check(s)) - it can only be voided while it is still waiting for its first pregnancy check. Edit it instead, or correct the follow-up first.`);
        };
        if (existing.status !== client_1.BreedingStatus.PENDING_CHECK ||
            existing._count.diagnoses > 0 ||
            existing._count.pregnancies > 0) {
            blocked();
        }
        if (existing.financeTransactionId) {
            await this.expenseService.voidInventoryConsumption(farmId, existing.financeTransactionId, userId);
        }
        const voidedAt = new Date();
        await this.prisma.$transaction(async (tx) => {
            const claimed = await tx.breedingEvent.updateMany({
                where: {
                    id,
                    voidedAt: null,
                    status: client_1.BreedingStatus.PENDING_CHECK,
                    diagnoses: { none: {} },
                    pregnancies: { none: {} },
                },
                data: {
                    status: client_1.BreedingStatus.VOIDED,
                    voidedAt,
                    voidedById: userId,
                    voidReason: dto.reason,
                },
            });
            if (claimed.count !== 1)
                blocked();
            await tx.heatEvent.updateMany({
                where: { resolvedByBreedingEventId: id },
                data: {
                    resolvedAt: null,
                    resolvedByBreedingEventId: null,
                    resolutionReason: null,
                },
            });
        });
        const hadStraw = existing.breedingMethod === client_1.BreedingMethod.AI &&
            existing.semenSource === client_1.SemenSource.FARM_INVENTORY &&
            !!existing.semenBatchId;
        let strawRestored = false;
        if (hadStraw && existing.semenBatchId) {
            try {
                await this.semenService.restoreStraw(farmId, existing.semenBatchId, 1, 'Breeding event voided', id, userId);
                strawRestored = true;
            }
            catch (err) {
                this.log.warn('Could not restore straw for voided breeding', {
                    breedingEventId: id,
                    semenBatchId: existing.semenBatchId,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }
        await this.prisma.task.updateMany({
            where: {
                farmId,
                sourceEventType: 'BREEDING_EVENT',
                sourceEventId: id,
                status: { notIn: [client_1.TaskStatus.COMPLETED, client_1.TaskStatus.CANCELLED] },
            },
            data: {
                status: client_1.TaskStatus.CANCELLED,
                cancelledAt: voidedAt,
                cancelledById: userId,
                completionNote: `Breeding voided: ${dto.reason}`,
            },
        });
        await this.derivation.refreshDerivedState(farmId, existing.cattleId);
        await this.activityLog.record({
            farmId,
            module: client_1.ActivityLogModule.BREEDING,
            eventTitle: 'Voided: Breeding Event',
            actionDetails: `${label} voided - ${dto.reason}`,
            actorId: userId,
            relatedCattleId: existing.cattleId,
            taggedValues: [
                { key: 'reason', value: dto.reason },
                {
                    key: 'cost_reversed',
                    value: existing.financeTransactionId ? 'yes' : 'no',
                },
                { key: 'straw_restored', value: strawRestored ? 'yes' : 'no' },
            ],
        });
        this.log.info('Breeding event voided', { breedingEventId: id, farmId });
        return this.prisma.breedingEvent.findFirstOrThrow({ where: { id } });
    }
    async editPregnancyDiagnosis(farmId, userId, id, dto) {
        const existing = await this.prisma.pregnancyDiagnosis.findFirst({
            where: { id, cattle: { farmId } },
        });
        if (!existing)
            throw new common_1.NotFoundException('Pregnancy diagnosis not found');
        const newCattleId = dto.cattleId ?? existing.cattleId;
        if (dto.cattleId)
            await this.assertFemaleCattleInFarm(farmId, dto.cattleId);
        if (dto.breedingEventId) {
            await this.getBreedingEventForCattle(dto.breedingEventId, newCattleId);
        }
        const newExpectedCalvingDate = dto.expectedCalvingDate
            ? new Date(dto.expectedCalvingDate)
            : undefined;
        const updated = await this.prisma.pregnancyDiagnosis.update({
            where: { id },
            data: {
                cattleId: dto.cattleId,
                breedingEventId: dto.breedingEventId,
                diagnosisDate: dto.diagnosisDate
                    ? new Date(dto.diagnosisDate)
                    : undefined,
                result: dto.result,
                diagnosisMethod: dto.diagnosisMethod,
                gestationDay: dto.gestationDay,
                expectedCalvingDate: newExpectedCalvingDate,
                notes: dto.notes,
            },
        });
        const linkedPregnancy = await this.prisma.pregnancy.findFirst({
            where: { sourceDiagnosisId: id },
        });
        if (existing.result === client_1.PregnancyDiagnosisResult.PREGNANT &&
            dto.result === client_1.PregnancyDiagnosisResult.NOT_PREGNANT &&
            linkedPregnancy &&
            linkedPregnancy.status !== client_1.PregnancyStatus.FAILED) {
            await this.prisma.pregnancy.update({
                where: { id: linkedPregnancy.id },
                data: { status: client_1.PregnancyStatus.FAILED },
            });
            const confirmLog = await this.prisma.activityLog.findFirst({
                where: {
                    farmId,
                    relatedCattleId: existing.cattleId,
                    eventTitle: 'Pregnancy Confirmed',
                    aqrImpact: { not: null },
                },
                orderBy: { timestamp: 'desc' },
            });
            if (confirmLog) {
                await this.aqrService.reverseEvent(farmId, existing.cattleId, confirmLog.id, {
                    actorId: userId,
                    actionDetails: 'Pregnancy diagnosis edited to NOT_PREGNANT.',
                });
            }
        }
        if (dto.result === client_1.PregnancyDiagnosisResult.PREGNANT &&
            existing.result !== client_1.PregnancyDiagnosisResult.PREGNANT &&
            !linkedPregnancy) {
            const breedingEvent = updated.breedingEventId
                ? await this.prisma.breedingEvent.findUnique({
                    where: { id: updated.breedingEventId },
                })
                : null;
            const conceptionDate = breedingEvent?.breedingDate ?? updated.diagnosisDate;
            const calculatedCalvingDate = this.addDays(conceptionDate, 280);
            const expectedCalvingDate = newExpectedCalvingDate ?? calculatedCalvingDate;
            const newPregnancy = await this.prisma.pregnancy.create({
                data: {
                    cattleId: newCattleId,
                    breedingEventId: updated.breedingEventId,
                    conceptionDate,
                    calculatedCalvingDate,
                    expectedCalvingDate,
                    expectedCalvingDateSource: newExpectedCalvingDate
                        ? client_1.ExpectedCalvingDateSource.MANUAL
                        : client_1.ExpectedCalvingDateSource.SYSTEM,
                    gestationDays: updated.gestationDay,
                    status: client_1.PregnancyStatus.ACTIVE,
                    sourceDiagnosisId: id,
                },
            });
            await this.aqrService.applyEvent(farmId, newCattleId, 'pregnancy_confirmed', {
                actorId: userId,
                actionDetails: 'Pregnancy diagnosis edited to PREGNANT.',
            });
            if (newPregnancy.expectedCalvingDate) {
                const dryPeriodDays = await this.farmSettings.reproDryPeriodTargetDays(farmId);
                const { recommendedDryOffAt } = (0, lactation_dry_off_projection_1.computeDryOffProjection)({
                    isPregnant: true,
                    expectedCalvingDate: newPregnancy.expectedCalvingDate,
                    dryPeriodDays,
                });
                await this.prisma.lactation.updateMany({
                    where: { cattleId: newCattleId, status: client_1.LactationStatus.ACTIVE },
                    data: { recommendedDryOffAt },
                });
            }
        }
        if (newExpectedCalvingDate &&
            linkedPregnancy &&
            linkedPregnancy.status === client_1.PregnancyStatus.ACTIVE) {
            await this.prisma.pregnancy.update({
                where: { id: linkedPregnancy.id },
                data: {
                    expectedCalvingDate: newExpectedCalvingDate,
                    expectedCalvingDateSource: client_1.ExpectedCalvingDateSource.MANUAL,
                },
            });
        }
        await this.refreshBoth(farmId, existing.cattleId, newCattleId);
        await this.recordEdit(farmId, userId, 'Pregnancy Diagnosis', existing, dto, newCattleId);
        this.log.info('Pregnancy diagnosis edited', {
            pregnancyDiagnosisId: id,
            farmId,
        });
        return updated;
    }
    async editAbortionEvent(farmId, userId, id, dto) {
        const existing = await this.prisma.abortionEvent.findFirst({
            where: { id, cattle: { farmId } },
        });
        if (!existing)
            throw new common_1.NotFoundException('Abortion event not found');
        const newCattleId = dto.cattleId ?? existing.cattleId;
        if (dto.cattleId)
            await this.assertFemaleCattleInFarm(farmId, dto.cattleId);
        if (dto.pregnancyId) {
            const pregnancy = await this.prisma.pregnancy.findFirst({
                where: { id: dto.pregnancyId, cattleId: newCattleId },
            });
            if (!pregnancy) {
                throw new common_1.BadRequestException('Pregnancy must belong to the same cattle');
            }
        }
        const updated = await this.prisma.abortionEvent.update({
            where: { id },
            data: {
                cattleId: dto.cattleId,
                pregnancyId: dto.pregnancyId,
                abortionDate: dto.abortionDate ? new Date(dto.abortionDate) : undefined,
                gestationDay: dto.gestationDay,
                suspectedCause: dto.suspectedCause,
                notes: dto.notes,
            },
        });
        await this.refreshBoth(farmId, existing.cattleId, newCattleId);
        await this.recordEdit(farmId, userId, 'Abortion Event', existing, dto, newCattleId);
        this.log.info('Abortion event edited', { abortionEventId: id, farmId });
        return updated;
    }
    async editDryOff(farmId, userId, id, dto) {
        const existing = await this.prisma.dryPeriod.findFirst({
            where: { id, cattle: { farmId } },
        });
        if (!existing)
            throw new common_1.NotFoundException('Dry period not found');
        const newCattleId = dto.cattleId ?? existing.cattleId;
        if (dto.cattleId)
            await this.assertFemaleCattleInFarm(farmId, dto.cattleId);
        const newStartDate = dto.dryOffDate ? new Date(dto.dryOffDate) : undefined;
        let newExpectedEndDate;
        if (newStartDate) {
            const targetDays = await this.farmSettings.reproDryPeriodTargetDays(farmId);
            newExpectedEndDate = this.addDays(newStartDate, targetDays);
        }
        const updated = await this.prisma.dryPeriod.update({
            where: { id },
            data: {
                cattleId: dto.cattleId,
                startDate: newStartDate,
                expectedEndDate: newExpectedEndDate,
                notes: dto.notes,
                reason: dto.reason,
            },
        });
        if (newStartDate) {
            const linkedLactation = await this.prisma.lactation.findFirst({
                where: {
                    cattleId: existing.cattleId,
                    endReason: client_1.LactationEndReason.DRY_OFF,
                    endDate: existing.startDate,
                },
                orderBy: { endDate: 'desc' },
            });
            if (linkedLactation) {
                await this.prisma.lactation.update({
                    where: { id: linkedLactation.id },
                    data: { endDate: newStartDate },
                });
            }
        }
        await this.refreshBoth(farmId, existing.cattleId, newCattleId);
        await this.recordEdit(farmId, userId, 'Dry-Off', existing, dto, newCattleId);
        this.log.info('Dry-off edited', { dryPeriodId: id, farmId });
        return updated;
    }
    async assertCattleInFarm(farmId, cattleId) {
        const cattle = await this.prisma.cattle.findFirst({
            where: { id: cattleId, farmId },
        });
        if (!cattle)
            throw new common_1.BadRequestException('Cattle must belong to this farm');
        return cattle;
    }
    async assertFemaleCattleInFarm(farmId, cattleId) {
        const cattle = await this.assertCattleInFarm(farmId, cattleId);
        if (cattle.gender !== client_1.CattleGender.FEMALE) {
            throw new common_1.BadRequestException('Reproduction records can only be edited onto female cattle');
        }
        return cattle;
    }
    async assertServiceProviderInFarm(farmId, serviceProviderId) {
        const provider = await this.prisma.serviceProvider.findFirst({
            where: { id: serviceProviderId, farmId, deletedAt: null },
        });
        if (!provider) {
            throw new common_1.BadRequestException('serviceProviderId does not refer to an active service provider on this farm');
        }
        return provider;
    }
    async getBreedingEventForCattle(id, cattleId) {
        const event = await this.prisma.breedingEvent.findFirst({
            where: { id, cattleId },
        });
        if (!event) {
            throw new common_1.BadRequestException('Breeding event must belong to the same cattle');
        }
        if (event.voidedAt) {
            throw new common_1.BadRequestException('That breeding was voided - pick a live breeding.');
        }
        return event;
    }
    async refreshBoth(farmId, oldCattleId, newCattleId) {
        await this.derivation.refreshDerivedState(farmId, oldCattleId);
        if (newCattleId !== oldCattleId) {
            await this.derivation.refreshDerivedState(farmId, newCattleId);
        }
    }
    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }
    async recordEdit(farmId, userId, eventType, existing, dto, cattleId) {
        const changes = this.buildChanges(existing, dto);
        await this.activityLog.record({
            farmId,
            module: client_1.ActivityLogModule.BREEDING,
            eventTitle: `Edited: ${eventType}`,
            actionDetails: changes.length > 0
                ? `${eventType} edited — ${changes.map((c) => `${c.key}: ${c.value}`).join('; ')}`
                : `${eventType} edited (no field changes).`,
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
exports.ReproductionEditService = ReproductionEditService;
exports.ReproductionEditService = ReproductionEditService = ReproductionEditService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        reproduction_derivation_service_1.ReproductionDerivationService,
        semen_service_1.SemenService,
        expense_service_1.ExpenseService,
        task_service_1.TaskService,
        aqr_service_1.AqrService,
        activity_log_service_1.ActivityLogService,
        farm_settings_service_1.FarmSettingsService,
        logger_service_1.LoggerService])
], ReproductionEditService);
//# sourceMappingURL=reproduction-edit.service.js.map