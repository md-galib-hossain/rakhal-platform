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
exports.FeedRequirementsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const animal_category_1 = require("src/modules/cattle/domain/animal-category");
const herd_scope_1 = require("src/modules/cattle/domain/herd-scope");
const milk_service_1 = require("src/modules/milk/application/services/milk.service");
const requirements_1 = require("../../domain/requirements");
const requirement_aggregate_1 = require("../../domain/requirement-aggregate");
const manual_requirement_1 = require("../../domain/manual-requirement");
const requirement_settings_service_1 = require("./requirement-settings.service");
const feed_plan_resolver_service_1 = require("./feed-plan-resolver.service");
const program_fit_1 = require("../../domain/program-fit");
const requirement_settings_1 = require("../../domain/requirement-settings");
const MS_PER_DAY = 86_400_000;
let FeedRequirementsService = class FeedRequirementsService {
    prisma;
    milk;
    requirementSettings;
    programs;
    constructor(prisma, milk, requirementSettings, programs) {
        this.prisma = prisma;
        this.milk = milk;
        this.requirementSettings = requirementSettings;
        this.programs = programs;
    }
    async calc(farmId, query) {
        if (query.cattleId)
            return this.calcForCattle(farmId, query.cattleId, query);
        return this.calcManual(query, farmId);
    }
    async forManual(farmId, query) {
        const [manual, settings] = await Promise.all([
            this.calcManual(query, farmId),
            this.requirementSettings.resolve(farmId),
        ]);
        return {
            cattle_id: null,
            inputs: manual.inputs,
            flags: [],
            requirements: manual.requirements,
            bands: (0, program_fit_1.bandsFromSettings)(settings),
        };
    }
    async calcManual(query, farmId) {
        const settings = await this.requirementSettings.resolve(farmId);
        const req = (0, requirements_1.computeRequirements)({
            weightKg: query.weightKg,
            milkTargetL: query.milkTargetL,
            milkFatPct: query.milkFatPct,
            milkProteinPct: query.milkProteinPct,
            gestationDays: query.gestationDays,
            bcs: query.bcs,
            dim: query.dim,
            animalType: query.animalType,
        }, settings);
        return {
            inputs: {
                weight_kg: query.weightKg,
                milk_target_l: query.milkTargetL,
                milk_fat_pct: query.milkFatPct ?? 4.0,
                milk_protein_pct: query.milkProteinPct,
                gestation_days: query.gestationDays,
                bcs: query.bcs,
                dim: query.dim,
                animal_type: query.animalType ?? 'COW',
            },
            data_source: { weight: 'manual', milk_yield: 'manual' },
            requirements: this.reqShape(req),
        };
    }
    inferAnimalType(productionStatus, category) {
        if (category === 'HEIFER')
            return 'HEIFER';
        if (productionStatus === 'DRY')
            return 'DRY';
        return 'COW';
    }
    deriveDim(lactation, lastCalvingDate, now) {
        const daysSince = (d) => Math.max(0, Math.floor((now.getTime() - d.getTime()) / MS_PER_DAY));
        if (lactation) {
            if (lactation.isEstimated && lactation.estimatedDaysInMilk != null)
                return lactation.estimatedDaysInMilk;
            return daysSince(lactation.startDate);
        }
        return lastCalvingDate ? daysSince(lastCalvingDate) : null;
    }
    async calcForCattle(farmId, cattleId, query) {
        const cattle = await this.prisma.cattle.findFirst({
            where: { id: cattleId, ...(0, herd_scope_1.activeHerd)(farmId) },
            select: {
                id: true,
                lastWeightKg: true,
                lastBcs: true,
                productionStatus: true,
                gender: true,
                dateOfBirth: true,
                reproductionProfile: {
                    select: { totalCalvings: true, lastCalvingDate: true },
                },
                lactations: {
                    where: { status: 'ACTIVE' },
                    orderBy: { startDate: 'desc' },
                    take: 1,
                    select: {
                        startDate: true,
                        isEstimated: true,
                        estimatedDaysInMilk: true,
                    },
                },
            },
        });
        if (!cattle)
            throw new common_1.NotFoundException('Cattle not found');
        const now = new Date();
        const category = (0, animal_category_1.deriveAnimalCategory)({
            gender: cattle.gender,
            dateOfBirth: cattle.dateOfBirth,
            totalCalvings: cattle.reproductionProfile?.totalCalvings ?? 0,
            now,
        });
        const animalType = query.animalType ??
            this.inferAnimalType(cattle.productionStatus, category);
        const derivedDim = this.deriveDim(cattle.lactations[0], cattle.reproductionProfile?.lastCalvingDate, now);
        const dim = query.dim ?? derivedDim ?? undefined;
        const [gestationDays, avgYield] = await Promise.all([
            this.currentGestationDays(cattleId),
            this.milk.averageDailyYield(farmId, [cattleId]),
        ]);
        const weightSource = cattle.lastWeightKg != null ? 'cattle_record' : 'manual';
        const weightKg = cattle.lastWeightKg ?? query.weightKg;
        if (weightKg == null) {
            throw new common_1.BadRequestException('Cattle has no recorded weight — supply weightKg manually');
        }
        const milkFromRecords = avgYield.get(cattleId);
        const milkSource = milkFromRecords != null
            ? 'milk_log_7d_avg'
            : query.milkTargetL != null
                ? 'manual'
                : 'assumed_zero';
        const milkTargetL = milkFromRecords ?? query.milkTargetL ?? 0;
        const input = {
            weightKg,
            milkTargetL,
            milkFatPct: query.milkFatPct,
            milkProteinPct: query.milkProteinPct,
            gestationDays: query.gestationDays ?? gestationDays ?? undefined,
            bcs: query.bcs ?? cattle.lastBcs ?? undefined,
            dim,
            animalType,
        };
        const [settings, overrides] = await Promise.all([
            this.requirementSettings.resolve(farmId),
            this.overridesFor(farmId, [cattleId], now),
        ]);
        const resolved = this.resolveCow((0, requirements_1.computeRequirements)(input, settings), animalType, [], overrides.get(cattleId), settings);
        return {
            source: resolved.source,
            inputs: {
                weight_kg: weightKg,
                milk_target_l: milkTargetL,
                milk_fat_pct: query.milkFatPct ?? 4.0,
                gestation_days: input.gestationDays,
                bcs: input.bcs,
                dim,
                animal_type: animalType,
            },
            data_source: {
                weight: weightSource,
                milk_yield: milkSource,
                dim: query.dim != null
                    ? 'manual'
                    : derivedDim != null
                        ? 'derived_from_records'
                        : 'settings_default',
            },
            requirements: this.reqShape(resolved.requirements),
            ...this.manualShape(resolved),
        };
    }
    async overridesFor(farmId, cattleIds, boundary) {
        const out = new Map();
        if (cattleIds.length === 0)
            return out;
        const rows = await this.prisma.cattleRequirementOverride.findMany({
            where: {
                farmId,
                cattleId: { in: cattleIds },
                effectiveFrom: { lte: boundary },
                OR: [{ effectiveTo: null }, { effectiveTo: { gte: boundary } }],
            },
            orderBy: [{ effectiveFrom: 'desc' }, { id: 'desc' }],
        });
        for (const r of rows)
            if (!out.has(r.cattleId))
                out.set(r.cattleId, r);
        return out;
    }
    resolveCow(dynamicReq, animalType, flags, override, settings) {
        if (!override) {
            return {
                source: 'DYNAMIC',
                requirements: dynamicReq,
                dynamicRequirements: null,
                flags,
                manual: null,
            };
        }
        const staleness = (0, manual_requirement_1.isManualStale)(override.dynamicSnapshot, dynamicReq, animalType, settings.manualOverrideDriftPct);
        return {
            source: 'MANUAL',
            requirements: (0, manual_requirement_1.requirementsFromManual)(override, settings),
            dynamicRequirements: dynamicReq,
            flags: [],
            manual: {
                override_id: override.id,
                set_at: override.effectiveFrom,
                set_by: override.setBy,
                note: override.note,
                ...staleness,
            },
        };
    }
    manualShape(r) {
        return r.source === 'MANUAL' && r.dynamicRequirements
            ? {
                dynamic_requirements: this.reqShape(r.dynamicRequirements),
                manual: r.manual,
            }
            : {};
    }
    cowShape(c) {
        return {
            cattle_id: c.cattleId,
            source: c.source,
            inputs: c.inputs,
            flags: c.flags,
            requirements: this.reqShape(c.requirements),
            ...this.manualShape(c),
        };
    }
    async herdRequirementBlock(farmId) {
        const herd = await this.prisma.cattle.findMany({
            where: (0, herd_scope_1.activeHerd)(farmId),
            select: { id: true },
        });
        if (herd.length === 0)
            return null;
        const { cows } = await this.resolveMany(farmId, herd.map((c) => c.id));
        const manualCows = cows.filter((c) => c.source === 'MANUAL');
        const weighed = cows.filter((c) => c.source === 'MANUAL' || !c.flags.includes('weight_estimated'));
        if (weighed.length === 0)
            return null;
        const agg = (0, requirement_aggregate_1.aggregateRequirements)(cows.map((c) => c.requirements));
        const mean = (values) => values.length > 0
            ? values.reduce((a, b) => a + b, 0) / values.length
            : null;
        const num = (c, k) => c.inputs[k];
        const weightKg = mean(weighed
            .map((c) => num(c, 'weight_kg'))
            .filter((v) => v != null));
        const yields = cows
            .map((c) => num(c, 'milk_target_l'))
            .filter((v) => v != null && v > 0);
        const bcs = mean(cows.map((c) => num(c, 'bcs')).filter((v) => v != null));
        return {
            headcount: cows.length,
            manual_headcount: manualCows.length,
            ca_p_headcount: agg.caPHeadcount,
            inputs: {
                weight_kg: round2(weightKg),
                milk_target_l: round2(mean(yields) ?? 0),
                bcs: bcs != null ? round2(bcs) : null,
                cattle_with_weight: weighed.length,
                cattle_with_milk_data: yields.length,
            },
            data_source: {
                weight: 'cattle_record_avg',
                milk_yield: yields.length > 0 ? 'milk_log_7d_avg' : 'assumed_zero',
            },
            per_cow: this.reqShape(agg.mean),
            herd_total: this.reqShape(agg.total),
        };
    }
    async getTodaysRequirement(farmId) {
        const [requirement, cows] = await Promise.all([
            this.herdRequirementBlock(farmId),
            this.prisma.cattle.findMany({
                where: (0, herd_scope_1.activeHerd)(farmId),
                select: { id: true },
            }),
        ]);
        const programs = await this.programs.resolveForCattle(farmId, cows.map((c) => c.id));
        if (programs.size === 0) {
            return {
                by_ingredient: [],
                by_ration: [],
                grand_total_kg: 0,
                requirement,
                has_active_ration: false,
            };
        }
        const byPlan = new Map();
        for (const p of programs.values()) {
            const e = byPlan.get(p.planId) ?? { program: p, heads: 0 };
            e.heads += 1;
            byPlan.set(p.planId, e);
        }
        const allLines = [...byPlan.values()].flatMap((e) => e.program.lines);
        const itemIds = [
            ...new Set(allLines.map((l) => l.feedItemId).filter((x) => !!x)),
        ];
        const recipeIds = [
            ...new Set(allLines.map((l) => l.concentrationId).filter((x) => !!x)),
        ];
        const [items, recipes] = await Promise.all([
            this.prisma.feedItem.findMany({
                where: { farmId, id: { in: itemIds } },
                select: { id: true, name: true },
            }),
            this.prisma.feedConcentration.findMany({
                where: { farmId, id: { in: recipeIds } },
                select: { id: true, name: true },
            }),
        ]);
        const nameByKey = new Map([
            ...items.map((i) => [i.id, i.name]),
            ...recipes.map((r) => [r.id, r.name]),
        ]);
        const totalsByKey = new Map();
        const byRation = [];
        for (const { program, heads } of byPlan.values()) {
            let planTotalKg = 0;
            for (const line of program.lines) {
                const kg = round2(line.kgPerDay * heads);
                planTotalKg += kg;
                const key = (line.feedItemId ?? line.concentrationId);
                totalsByKey.set(key, round2((totalsByKey.get(key) ?? 0) + kg));
            }
            const only = program.lines.length === 1 ? program.lines[0].concentrationId : null;
            byRation.push({
                plan_id: program.planId,
                concentration_id: only,
                name: program.planName,
                headcount: heads,
                total_kg: round2(planTotalKg),
            });
        }
        const byIngredient = [...totalsByKey.entries()]
            .map(([key, totalKg]) => ({
            ingredient_id: key,
            name: nameByKey.get(key) ?? key,
            total_kg: round2(totalKg),
        }))
            .sort((x, y) => y.total_kg - x.total_kg);
        return {
            by_ingredient: byIngredient,
            by_ration: byRation,
            grand_total_kg: round2(byIngredient.reduce((sum, i) => sum + i.total_kg, 0)),
            requirement,
            has_active_ration: true,
        };
    }
    async resolveForConcentrations(farmId, rows) {
        const out = new Map();
        if (rows.length === 0)
            return out;
        const settings = await this.requirementSettings.resolve(farmId);
        const scorable = rows.filter((r) => r.kind !== 'CONCENTRATE_TEMPLATE');
        for (const r of rows) {
            if (r.kind === 'CONCENTRATE_TEMPLATE')
                out.set(r.id, null);
        }
        if (scorable.length === 0)
            return out;
        const directCattleIds = [
            ...new Set(scorable
                .filter((r) => r.targetType === 'INDIVIDUAL' && r.cattleId)
                .map((r) => r.cattleId)),
        ];
        const cattle = directCattleIds.length > 0
            ? await this.prisma.cattle.findMany({
                where: {
                    ...(0, herd_scope_1.activeHerd)(farmId),
                    id: { in: directCattleIds },
                },
                select: {
                    id: true,
                    lastWeightKg: true,
                    lastBcs: true,
                    productionStatus: true,
                    gender: true,
                    dateOfBirth: true,
                    reproductionProfile: { select: { totalCalvings: true } },
                },
            })
            : [];
        const cattleById = new Map(cattle.map((c) => [c.id, c]));
        const allIds = cattle.map((c) => c.id);
        const [gestationByCow, yieldByCow, overrides] = await Promise.all([
            this.gestationDaysFor(allIds),
            allIds.length > 0
                ? this.milk.averageDailyYield(farmId, allIds)
                : Promise.resolve(new Map()),
            this.overridesFor(farmId, allIds, new Date()),
        ]);
        for (const row of scorable) {
            let req = null;
            const manualRow = row.targetType === 'INDIVIDUAL' && row.cattleId
                ? overrides.get(row.cattleId)
                : undefined;
            if (manualRow) {
                out.set(row.id, (0, manual_requirement_1.requirementsFromManual)(manualRow, settings));
                continue;
            }
            if (row.targetType === 'INDIVIDUAL' && row.cattleId) {
                const c = cattleById.get(row.cattleId);
                const weightKg = c?.lastWeightKg ?? row.targetWeightKg;
                if (weightKg != null) {
                    req = (0, requirements_1.computeRequirements)({
                        weightKg,
                        milkTargetL: (c ? yieldByCow.get(c.id) : undefined) ?? row.targetMilkL ?? 0,
                        gestationDays: c ? gestationByCow.get(c.id) : undefined,
                        bcs: c?.lastBcs ?? undefined,
                        animalType: c
                            ? this.inferAnimalType(c.productionStatus, (0, animal_category_1.deriveAnimalCategory)({
                                gender: c.gender,
                                dateOfBirth: c.dateOfBirth,
                                totalCalvings: c.reproductionProfile?.totalCalvings ?? 0,
                            }))
                            : undefined,
                    }, settings);
                }
            }
            if (req == null &&
                row.targetWeightKg != null &&
                row.targetMilkL != null) {
                req = (0, requirements_1.computeRequirements)({ weightKg: row.targetWeightKg, milkTargetL: row.targetMilkL }, settings);
            }
            out.set(row.id, req);
        }
        return out;
    }
    async forCattle(farmId, cattleIds, date) {
        const r = await this.resolveMany(farmId, cattleIds, date);
        return {
            date: r.date,
            cows: r.cows.map((c) => this.cowShape(c)),
            missing_cattle_ids: r.missing,
            bands: r.bands,
        };
    }
    async resolveOne(farmId, cattleId) {
        const { cows } = await this.resolveMany(farmId, [cattleId]);
        const cow = cows[0];
        if (!cow)
            return null;
        const calculated = cow.dynamicRequirements ?? cow.requirements;
        return {
            shaped: this.cowShape(cow),
            snapshot: {
                dm_kg: calculated.dmKg,
                cp_kg: calculated.cpKg,
                me_mj: calculated.meMj,
                animal_type: cow.inputs.animal_type,
                inputs: cow.inputs,
            },
        };
    }
    async resolveMany(farmId, cattleIds, date) {
        const asOf = date ? new Date(date) : new Date();
        const boundary = date ? new Date(asOf.getTime() + MS_PER_DAY) : asOf;
        const ids = [...new Set(cattleIds)];
        const empty = {
            date: asOf.toISOString().slice(0, 10),
            cows: [],
            missing: [],
            bands: (0, program_fit_1.bandsFromSettings)(requirement_settings_1.DEFAULT_REQUIREMENT_SETTINGS),
        };
        if (ids.length === 0)
            return empty;
        const [cattle, weighIns, settings, overrides] = await Promise.all([
            this.prisma.cattle.findMany({
                where: { ...(0, herd_scope_1.activeHerd)(farmId), id: { in: ids } },
                select: {
                    id: true,
                    lastWeightKg: true,
                    lastBcs: true,
                    productionStatus: true,
                    gender: true,
                    dateOfBirth: true,
                    reproductionProfile: {
                        select: { totalCalvings: true, lastCalvingDate: true },
                    },
                    lactations: {
                        where: { status: 'ACTIVE' },
                        orderBy: { startDate: 'desc' },
                        take: 1,
                        select: {
                            startDate: true,
                            isEstimated: true,
                            estimatedDaysInMilk: true,
                        },
                    },
                },
            }),
            this.prisma.weightRecord.findMany({
                where: { cattleId: { in: ids } },
                orderBy: { recordedDate: 'desc' },
                distinct: ['cattleId'],
                select: { cattleId: true, recordedDate: true },
            }),
            this.requirementSettings.resolve(farmId),
            this.overridesFor(farmId, ids, boundary),
        ]);
        const foundIds = cattle.map((c) => c.id);
        const [gestationByCow, yieldByCow] = await Promise.all([
            this.gestationDaysFor(foundIds),
            foundIds.length > 0
                ? this.milk.averageDailyYield(farmId, foundIds, asOf)
                : Promise.resolve(new Map()),
        ]);
        const weighInDate = new Map(weighIns.map((w) => [w.cattleId, w.recordedDate]));
        const cows = cattle.map((c) => {
            const flags = [];
            const category = (0, animal_category_1.deriveAnimalCategory)({
                gender: c.gender,
                dateOfBirth: c.dateOfBirth,
                totalCalvings: c.reproductionProfile?.totalCalvings ?? 0,
                now: asOf,
            });
            const animalType = this.inferAnimalType(c.productionStatus, category);
            const milking = animalType === 'COW';
            let weightKg = c.lastWeightKg;
            if (weightKg == null) {
                weightKg = settings.defaultWeightKg;
                flags.push('weight_estimated');
            }
            else {
                const weighed = weighInDate.get(c.id);
                if (weighed && (asOf.getTime() - weighed.getTime()) / MS_PER_DAY > 60) {
                    flags.push('weight_stale');
                }
            }
            if (c.lastBcs == null)
                flags.push('bcs_default');
            const milkFromRecords = yieldByCow.get(c.id);
            if (milkFromRecords == null && milking)
                flags.push('milk_missing');
            const derivedDim = this.deriveDim(c.lactations[0], c.reproductionProfile?.lastCalvingDate, asOf);
            if (derivedDim == null && milking)
                flags.push('dim_default');
            const input = {
                weightKg,
                milkTargetL: milkFromRecords ?? 0,
                gestationDays: gestationByCow.get(c.id),
                bcs: c.lastBcs ?? undefined,
                dim: derivedDim ?? undefined,
                animalType,
            };
            const resolved = this.resolveCow((0, requirements_1.computeRequirements)(input, settings), animalType, flags, overrides.get(c.id), settings);
            return {
                cattleId: c.id,
                inputs: {
                    weight_kg: weightKg,
                    milk_target_l: milkFromRecords ?? 0,
                    gestation_days: input.gestationDays,
                    bcs: input.bcs,
                    dim: derivedDim ?? settings.defaultDaysInMilk,
                    animal_type: animalType,
                },
                ...resolved,
            };
        });
        return {
            date: asOf.toISOString().slice(0, 10),
            cows,
            missing: ids.filter((id) => !foundIds.includes(id)),
            bands: (0, program_fit_1.bandsFromSettings)(settings),
        };
    }
    async gestationDaysFor(cattleIds) {
        const out = new Map();
        if (cattleIds.length === 0)
            return out;
        const profiles = await this.prisma.reproductionProfile.findMany({
            where: { cattleId: { in: cattleIds }, currentPregnancyId: { not: null } },
            select: { cattleId: true, currentPregnancyId: true },
        });
        if (profiles.length === 0)
            return out;
        const pregnancies = await this.prisma.pregnancy.findMany({
            where: {
                id: { in: profiles.map((p) => p.currentPregnancyId) },
                status: 'ACTIVE',
            },
            select: { id: true, conceptionDate: true },
        });
        const conceptionById = new Map(pregnancies.map((p) => [p.id, p.conceptionDate]));
        for (const profile of profiles) {
            const conception = conceptionById.get(profile.currentPregnancyId);
            if (!conception)
                continue;
            out.set(profile.cattleId, Math.max(0, Math.floor((Date.now() - conception.getTime()) / MS_PER_DAY)));
        }
        return out;
    }
    async currentGestationDays(cattleId) {
        const profile = await this.prisma.reproductionProfile.findUnique({
            where: { cattleId },
            select: { currentPregnancyId: true },
        });
        if (!profile?.currentPregnancyId)
            return null;
        const pregnancy = await this.prisma.pregnancy.findFirst({
            where: { id: profile.currentPregnancyId, status: 'ACTIVE' },
            select: { conceptionDate: true },
        });
        if (!pregnancy?.conceptionDate)
            return null;
        return Math.max(0, Math.floor((Date.now() - pregnancy.conceptionDate.getTime()) / MS_PER_DAY));
    }
    reqShape(req) {
        return {
            dm_kg: req.dmKg,
            cp_kg: req.cpKg,
            me_mj: req.meMj,
            ndf_kg: req.ndfKg,
            fat_kg: req.fatKg,
            ne_mcal: req.neMcal,
            energy_density_mj_per_kg_dm: req.energyDensityMjPerKgDm,
            cp_pct_of_dm: req.cpPctOfDm,
            tdn_kg: req.tdnKg,
            calcium_kg: req.calciumKg,
            phosphorus_kg: req.phosphorusKg,
            adf_kg: req.adfKg,
            rdp_pct: req.rdpPct,
            rup_pct: req.rupPct,
            ndf_max_kg: req.ndfMaxKg,
            ca_p_ratio_target: req.caPRatioTarget,
            breakdown: req.breakdown
                ? {
                    dm: req.breakdown.dm,
                    me: req.breakdown.me,
                    cp: req.breakdown.cp,
                }
                : null,
        };
    }
};
exports.FeedRequirementsService = FeedRequirementsService;
exports.FeedRequirementsService = FeedRequirementsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        milk_service_1.MilkService,
        requirement_settings_service_1.RequirementSettingsService,
        feed_plan_resolver_service_1.FeedPlanResolverService])
], FeedRequirementsService);
const round2 = (v) => Math.round(v * 100) / 100;
//# sourceMappingURL=feed-requirements.service.js.map