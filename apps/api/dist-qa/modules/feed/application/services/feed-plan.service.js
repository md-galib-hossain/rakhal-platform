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
var FeedPlanService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedPlanService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const pagination_1 = require("src/common/pagination");
const herd_scope_1 = require("src/modules/cattle/domain/herd-scope");
const feed_lot_resolver_service_1 = require("./feed-lot-resolver.service");
const feed_requirements_service_1 = require("./feed-requirements.service");
const feed_plan_assignment_service_1 = require("./feed-plan-assignment.service");
const feed_plan_resolver_service_1 = require("./feed-plan-resolver.service");
const program_fit_1 = require("../../domain/program-fit");
const plan_nutrition_1 = require("../../domain/plan-nutrition");
const round2 = (v) => Math.round(v * 100) / 100;
const round1 = (v) => Math.round(v * 10) / 10;
let FeedPlanService = FeedPlanService_1 = class FeedPlanService {
    prisma;
    requirements;
    lotResolver;
    assignments;
    programs;
    log;
    constructor(prisma, logger, requirements, lotResolver, assignments, programs) {
        this.prisma = prisma;
        this.requirements = requirements;
        this.lotResolver = lotResolver;
        this.assignments = assignments;
        this.programs = programs;
        this.log = logger.setContext(FeedPlanService_1.name);
    }
    async create(farmId, userId, dto) {
        const kind = dto.kind ?? 'PLAN';
        await this.assertMadeFor(farmId, dto);
        const names = await this.validateLines(farmId, kind, dto.lines);
        const referenceRequirement = await this.captureReference(farmId, dto);
        try {
            const plan = await this.prisma.feedPlan.create({
                data: {
                    farmId,
                    name: dto.name,
                    kind,
                    notes: dto.notes ?? null,
                    madeForCattleId: dto.madeForCattleId ?? null,
                    madeForAnimalGroupId: dto.madeForAnimalGroupId ?? null,
                    referenceRequirement: referenceRequirement ?? client_1.Prisma.JsonNull,
                    createdBy: userId,
                    lines: { create: this.lineRows(farmId, dto.lines) },
                },
                include: { lines: { orderBy: { sortOrder: 'asc' } } },
            });
            this.log.info('Feed plan created', { farmId, planId: plan.id });
            return this.mapPlan(plan, names);
        }
        catch (e) {
            throw this.mapConflict(e);
        }
    }
    async update(farmId, userId, id, dto) {
        const existing = await this.findActive(farmId, id);
        const merged = {
            madeForCattleId: existing.madeForCattleId,
            madeForAnimalGroupId: existing.madeForAnimalGroupId,
        };
        const madeForChanged = dto.madeForCattleId !== undefined ||
            dto.madeForAnimalGroupId !== undefined;
        if (madeForChanged) {
            merged.madeForCattleId = dto.madeForCattleId ?? null;
            merged.madeForAnimalGroupId = dto.madeForAnimalGroupId ?? null;
            await this.assertMadeFor(farmId, merged);
        }
        const kind = dto.kind ?? existing.kind;
        const names = dto.lines !== undefined || dto.kind !== undefined
            ? await this.validateLines(farmId, kind, dto.lines ?? existing.lines.map((l) => this.toLineDto(l)))
            : await this.namesFor(farmId, existing.lines);
        const referenceRequirement = madeForChanged
            ? await this.captureReference(farmId, merged)
            : undefined;
        try {
            const plan = await this.prisma.$transaction(async (tx) => {
                if (dto.lines) {
                    await tx.feedPlanLine.deleteMany({ where: { planId: id } });
                    await tx.feedPlanLine.createMany({
                        data: this.lineRows(farmId, dto.lines).map((l) => ({
                            ...l,
                            planId: id,
                        })),
                    });
                }
                return tx.feedPlan.update({
                    where: { id },
                    data: {
                        ...(dto.name !== undefined && { name: dto.name }),
                        ...(dto.kind !== undefined && { kind: dto.kind }),
                        ...(dto.notes !== undefined && { notes: dto.notes }),
                        ...(madeForChanged && {
                            madeForCattleId: merged.madeForCattleId,
                            madeForAnimalGroupId: merged.madeForAnimalGroupId,
                            referenceRequirement: referenceRequirement ?? client_1.Prisma.JsonNull,
                        }),
                    },
                    include: { lines: { orderBy: { sortOrder: 'asc' } } },
                });
            });
            this.log.info('Feed plan updated', { farmId, planId: id, userId });
            const applied = await this.assignments.appliedTo(farmId, [id]);
            return this.mapPlan(plan, names, applied.get(id));
        }
        catch (e) {
            throw this.mapConflict(e);
        }
    }
    async list(farmId, query) {
        const rows = await this.prisma.feedPlan.findMany({
            where: {
                farmId,
                ...(query.includeArchived ? {} : { isActive: true }),
                ...(query.kind ? { kind: query.kind } : {}),
                ...(query.search
                    ? { name: { contains: query.search, mode: 'insensitive' } }
                    : {}),
            },
            include: { lines: { orderBy: { sortOrder: 'asc' } } },
            orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
        });
        const page = (0, pagination_1.toCursorPage)(rows, query);
        const names = await this.namesFor(farmId, page.items.flatMap((p) => p.lines));
        const applied = await this.assignments.appliedTo(farmId, page.items.map((p) => p.id));
        return {
            items: page.items.map((p) => this.mapPlan(p, names, applied.get(p.id))),
            meta: page.meta,
        };
    }
    async get(farmId, id) {
        const plan = await this.prisma.feedPlan.findFirst({
            where: { id, farmId },
            include: { lines: { orderBy: { sortOrder: 'asc' } } },
        });
        if (!plan)
            throw new common_1.NotFoundException('Feed plan not found');
        const applied = await this.assignments.appliedTo(farmId, [id]);
        return this.mapPlan(plan, await this.namesFor(farmId, plan.lines), applied.get(id));
    }
    async archive(farmId, userId, id, removeAssignments = false) {
        await this.findActive(farmId, id);
        const active = await this.assignments.countActive(farmId, id);
        if (active > 0 && !removeAssignments) {
            throw new common_1.ConflictException(`This plan is applied to ${active} target${active === 1 ? '' : 's'}. Remove it from them first, or use "remove from all & delete".`);
        }
        await this.prisma.$transaction(async (tx) => {
            if (active > 0) {
                await this.assignments.removeAllForPlan(tx, farmId, userId, id);
            }
            await tx.feedPlan.update({ where: { id }, data: { isActive: false } });
        });
        this.log.info('Feed plan archived', {
            farmId,
            planId: id,
            userId,
            removedAssignments: active,
        });
        return { id, archived: true, removed_assignments: active };
    }
    async fit(farmId, id, query) {
        const plan = await this.prisma.feedPlan.findFirst({
            where: { id, farmId },
            include: { lines: { orderBy: { sortOrder: 'asc' } } },
        });
        if (!plan)
            throw new common_1.NotFoundException('Feed plan not found');
        const cattleIds = query.cattleIds?.length
            ? query.cattleIds
            : plan.madeForCattleId
                ? [plan.madeForCattleId]
                : [];
        if (cattleIds.length === 0) {
            throw new common_1.BadRequestException('Pass cattleIds — this plan has no "made for" animal to default to');
        }
        const [req, lines] = await Promise.all([
            this.requirements.forCattle(farmId, cattleIds, query.date),
            this.resolveSupply(farmId, plan),
        ]);
        const { supply, supplyComplete, cowFit } = this.fitBuilder(lines, req.bands);
        return {
            plan_id: plan.id,
            date: req.date,
            lines,
            supply,
            supply_complete: supplyComplete,
            cows: req.cows.map((c) => ({ cattle_id: c.cattle_id, ...cowFit(c) })),
            missing_cattle_ids: req.missing_cattle_ids,
        };
    }
    async previewFit(farmId, dto) {
        if (!!dto.cattleId === !!dto.manual) {
            throw new common_1.BadRequestException('Pass exactly one of cattleId (a saved animal) or manual (weight and milk you enter)');
        }
        const previewLines = dto.lines.map((l, i) => ({
            id: `preview-${i}`,
            lineType: l.lineType,
            feedItemId: l.lineType === 'FEED_ITEM' ? (l.feedItemId ?? null) : null,
            concentrationId: l.lineType === 'PREPARED' ? (l.concentrationId ?? null) : null,
            kgPerDay: l.kgPerDay,
            sortOrder: i,
        }));
        const [lines, animal] = await Promise.all([
            this.resolveSupply(farmId, { lines: previewLines }),
            dto.cattleId
                ? this.requirements
                    .forCattle(farmId, [dto.cattleId])
                    .then((r) => ({ cow: r.cows[0] ?? null, bands: r.bands }))
                : this.requirements
                    .forManual(farmId, dto.manual)
                    .then((r) => ({ cow: r, bands: r.bands })),
        ]);
        if (!animal.cow)
            throw new common_1.NotFoundException('Animal not found');
        const { supply, supplyComplete, cowFit } = this.fitBuilder(lines, animal.bands);
        return {
            lines,
            supply,
            supply_complete: supplyComplete,
            ...cowFit(animal.cow),
        };
    }
    fitBuilder(lines, bands) {
        const total = lines.reduce((t, l) => ({
            as_fed_kg: t.as_fed_kg + l.supply.as_fed_kg,
            dm_kg: t.dm_kg + (l.supply.dm_kg ?? 0),
            cp_kg: t.cp_kg + (l.supply.cp_kg ?? 0),
            me_mj: t.me_mj + (l.supply.me_mj ?? 0),
        }), { as_fed_kg: 0, dm_kg: 0, cp_kg: 0, me_mj: 0 });
        const supply = {
            as_fed_kg: round2(total.as_fed_kg),
            dm_kg: round2(total.dm_kg),
            cp_kg: round2(total.cp_kg),
            me_mj: round2(total.me_mj),
        };
        const supplyComplete = lines.every((l) => l.density != null);
        const delta = (have, need) => need > 0 ? round1((have / need - 1) * 100) : null;
        const nutrientSupply = (0, plan_nutrition_1.computeNutrientSupply)(lines.map((l) => ({ kgPerDay: l.kg_per_day, profile: l.nutrition })));
        const cowFit = (c) => ({
            source: c.source ?? 'DYNAMIC',
            ...(c.manual
                ? { dynamic_requirements: c.dynamic_requirements, manual: c.manual }
                : {}),
            requirement: {
                dm_kg: c.requirements.dm_kg,
                cp_kg: c.requirements.cp_kg,
                me_mj: c.requirements.me_mj,
            },
            requirement_full: c.requirements,
            delta_pct: {
                dm: delta(supply.dm_kg, c.requirements.dm_kg),
                cp: delta(supply.cp_kg, c.requirements.cp_kg),
                me: delta(supply.me_mj, c.requirements.me_mj),
            },
            fit: (0, program_fit_1.toApiFit)((0, program_fit_1.computeProgramFit)({ dmKg: supply.dm_kg, cpKg: supply.cp_kg, meMj: supply.me_mj }, {
                dmKg: c.requirements.dm_kg,
                cpKg: c.requirements.cp_kg,
                meMj: c.requirements.me_mj,
            }, bands, c.flags.length > 0 || !supplyComplete)),
            nutrients: (0, plan_nutrition_1.buildNutrientRows)(nutrientSupply, c.requirements, bands),
            inputs: c.inputs,
            flags: c.flags,
        });
        return { supply, supplyComplete, cowFit };
    }
    async programForCattle(farmId, cattleId) {
        const cow = await this.prisma.cattle.findFirst({
            where: { id: cattleId, ...(0, herd_scope_1.activeHerd)(farmId) },
            select: { id: true },
        });
        if (!cow)
            throw new common_1.NotFoundException('Cattle not found');
        const program = (await this.programs.resolveForCattle(farmId, [cattleId])).get(cattleId);
        if (!program)
            return { program: null };
        const lines = await this.resolveSupply(farmId, { lines: program.lines });
        return {
            program: {
                assignment_id: program.assignmentId,
                plan_id: program.planId,
                plan_name: program.planName,
                kind: program.kind,
                via: program.via,
                group_id: program.groupId ?? null,
                conflict: program.conflict,
                lines: lines.map((l) => ({
                    line_id: l.line_id,
                    line_type: l.line_type,
                    name: l.name,
                    kg_per_day: l.kg_per_day,
                    source: l.source,
                    density: l.density,
                    stock_ok: l.stock_ok,
                })),
            },
        };
    }
    async resolveSupply(farmId, plan) {
        const itemLines = plan.lines.filter((l) => l.feedItemId);
        const recipeLines = plan.lines.filter((l) => l.concentrationId);
        const names = await this.namesFor(farmId, plan.lines);
        const [items, stocks] = await Promise.all([
            this.prisma.feedItem.findMany({
                where: {
                    farmId,
                    id: { in: itemLines.map((l) => l.feedItemId) },
                },
                select: {
                    id: true,
                    batches: {
                        where: { deletedAt: null },
                        orderBy: [{ purchaseDate: 'asc' }, { createdAt: 'asc' }],
                        select: { currentStock: true, nutritionProfile: true },
                    },
                },
            }),
            this.prisma.feedStock.findMany({
                where: {
                    farmId,
                    deletedAt: null,
                    sourceConcentrationId: {
                        in: recipeLines.map((l) => l.concentrationId),
                    },
                },
                orderBy: { producedAt: 'desc' },
                include: { nutritionProfile: true },
            }),
        ]);
        const effective = await this.lotResolver.effectiveLines(farmId, itemLines.map((l) => ({ ingredientId: null, feedItemId: l.feedItemId })));
        const itemById = new Map(items.map((i) => [i.id, i]));
        return plan.lines.map((l) => {
            let density = null;
            let stockOk = false;
            let name = '';
            let nutrition = null;
            let source = null;
            if (l.feedItemId) {
                name = names.items.get(l.feedItemId) ?? l.feedItemId;
                const eff = effective.get(l.feedItemId);
                if (eff) {
                    density = {
                        dm_pct: eff.dmPct,
                        cp_pct: eff.cpPct,
                        me_mj_per_kg_dm: eff.meMjPerKgDm,
                    };
                }
                const batches = itemById.get(l.feedItemId)?.batches ?? [];
                stockOk = batches.some((b) => b.currentStock > 0);
                const head = batches.find((b) => b.currentStock > 0) ??
                    batches[batches.length - 1];
                nutrition = head?.nutritionProfile ?? null;
                source = {
                    source_type: 'FEED_ITEM',
                    feed_item_id: l.feedItemId,
                    feed_stock_id: null,
                };
            }
            else {
                name = names.recipes.get(l.concentrationId)?.name ?? '';
                const lots = stocks.filter((s) => s.sourceConcentrationId === l.concentrationId);
                const lot = lots.find((s) => s.currentStockKg > 0) ?? lots[0];
                if (lot) {
                    nutrition = lot.nutritionProfile;
                    density = {
                        dm_pct: lot.nutritionProfile.dmPct,
                        cp_pct: lot.nutritionProfile.cpPct,
                        me_mj_per_kg_dm: lot.nutritionProfile.meMjPerKgDm,
                    };
                }
                stockOk = lots.some((s) => s.currentStockKg > 0);
                if (lot) {
                    source = {
                        source_type: 'FEED_STOCK',
                        feed_item_id: null,
                        feed_stock_id: lot.id,
                    };
                }
            }
            const dmKg = density ? l.kgPerDay * (density.dm_pct / 100) : null;
            const cpKg = dmKg != null && density ? dmKg * (density.cp_pct / 100) : null;
            const meMj = dmKg != null && density ? dmKg * density.me_mj_per_kg_dm : null;
            return {
                line_id: l.id,
                line_type: l.lineType,
                feed_item_id: l.feedItemId,
                concentration_id: l.concentrationId,
                name,
                kg_per_day: l.kgPerDay,
                density,
                source,
                stock_ok: stockOk,
                nutrition,
                supply: {
                    as_fed_kg: l.kgPerDay,
                    dm_kg: dmKg != null ? round2(dmKg) : null,
                    cp_kg: cpKg != null ? round2(cpKg) : null,
                    me_mj: meMj != null ? round2(meMj) : null,
                },
            };
        });
    }
    async findActive(farmId, id) {
        const plan = await this.prisma.feedPlan.findFirst({
            where: { id, farmId, isActive: true },
            include: { lines: { orderBy: { sortOrder: 'asc' } } },
        });
        if (!plan)
            throw new common_1.NotFoundException('Feed plan not found');
        return plan;
    }
    lineRows(farmId, lines) {
        return lines.map((l, i) => ({
            farmId,
            lineType: l.lineType,
            feedItemId: l.lineType === 'FEED_ITEM' ? (l.feedItemId ?? null) : null,
            concentrationId: l.lineType === 'PREPARED' ? (l.concentrationId ?? null) : null,
            kgPerDay: round2(l.kgPerDay),
            sortOrder: i,
        }));
    }
    toLineDto(l) {
        return {
            lineType: l.lineType,
            feedItemId: l.feedItemId ?? undefined,
            concentrationId: l.concentrationId ?? undefined,
            kgPerDay: l.kgPerDay,
        };
    }
    async validateLines(farmId, kind, lines) {
        const seen = new Set();
        for (const l of lines) {
            const key = l.lineType === 'FEED_ITEM'
                ? `i:${l.feedItemId}`
                : `c:${l.concentrationId}`;
            if (seen.has(key)) {
                throw new common_1.BadRequestException('A feed item or recipe can appear in a plan only once — combine the quantities');
            }
            seen.add(key);
        }
        const itemIds = lines
            .filter((l) => l.lineType === 'FEED_ITEM')
            .map((l) => l.feedItemId);
        const recipeIds = lines
            .filter((l) => l.lineType === 'PREPARED')
            .map((l) => l.concentrationId);
        const [items, recipes] = await Promise.all([
            this.prisma.feedItem.findMany({
                where: { farmId, deletedAt: null, id: { in: itemIds } },
                select: { id: true, name: true },
            }),
            this.prisma.feedConcentration.findMany({
                where: { farmId, deletedAt: null, id: { in: recipeIds } },
                select: { id: true, name: true, kind: true },
            }),
        ]);
        const missingItems = itemIds.filter((i) => !items.some((x) => x.id === i));
        if (missingItems.length) {
            throw new common_1.BadRequestException(`Feed item not found in this farm's inventory: ${missingItems.join(', ')}`);
        }
        const missingRecipes = recipeIds.filter((i) => !recipes.some((x) => x.id === i));
        if (missingRecipes.length) {
            throw new common_1.BadRequestException(`Concentrate/TMR recipe not found in this farm: ${missingRecipes.join(', ')}`);
        }
        if (kind !== 'PLAN') {
            const want = kind === 'TMR_SHORTCUT' ? 'FEED_MIXTURE' : 'CONCENTRATE_TEMPLATE';
            const only = lines.length === 1 && lines[0].lineType === 'PREPARED';
            const recipe = only ? recipes.find((r) => r.id === recipeIds[0]) : null;
            if (!only || recipe?.kind !== want) {
                throw new common_1.BadRequestException(`${kind} must be exactly one PREPARED line pointing at a ${want === 'FEED_MIXTURE' ? 'TMR (feed mixture)' : 'concentrate'} recipe`);
            }
        }
        return {
            items: new Map(items.map((i) => [i.id, i.name])),
            recipes: new Map(recipes.map((r) => [r.id, { name: r.name, kind: r.kind }])),
        };
    }
    async namesFor(farmId, lines) {
        const itemIds = [
            ...new Set(lines.map((l) => l.feedItemId).filter((x) => !!x)),
        ];
        const recipeIds = [
            ...new Set(lines.map((l) => l.concentrationId).filter((x) => !!x)),
        ];
        const [items, recipes] = await Promise.all([
            this.prisma.feedItem.findMany({
                where: { farmId, id: { in: itemIds } },
                select: { id: true, name: true },
            }),
            this.prisma.feedConcentration.findMany({
                where: { farmId, id: { in: recipeIds } },
                select: { id: true, name: true, kind: true },
            }),
        ]);
        return {
            items: new Map(items.map((i) => [i.id, i.name])),
            recipes: new Map(recipes.map((r) => [r.id, { name: r.name, kind: r.kind }])),
        };
    }
    async assertMadeFor(farmId, ref) {
        if (ref.madeForCattleId && ref.madeForAnimalGroupId) {
            throw new common_1.BadRequestException('A plan can be made for one animal or one group, not both');
        }
        if (ref.madeForCattleId) {
            const cow = await this.prisma.cattle.findFirst({
                where: { id: ref.madeForCattleId, ...(0, herd_scope_1.activeHerd)(farmId) },
                select: { id: true },
            });
            if (!cow)
                throw new common_1.NotFoundException('Cattle not found');
        }
        if (ref.madeForAnimalGroupId) {
            const group = await this.prisma.animalGroup.findFirst({
                where: { id: ref.madeForAnimalGroupId, farmId, deletedAt: null },
                select: { id: true },
            });
            if (!group)
                throw new common_1.NotFoundException('Animal group not found');
        }
    }
    async captureReference(farmId, ref) {
        let ids = [];
        let basis = null;
        if (ref.madeForCattleId) {
            ids = [ref.madeForCattleId];
            basis = 'COW';
        }
        else if (ref.madeForAnimalGroupId) {
            const members = await this.prisma.animalGroupMember.findMany({
                where: { groupId: ref.madeForAnimalGroupId, farmId },
                select: { cattleId: true },
            });
            ids = members.map((m) => m.cattleId);
            basis = 'GROUP_AVERAGE';
        }
        if (!basis || ids.length === 0)
            return null;
        const res = await this.requirements.forCattle(farmId, ids);
        if (res.cows.length === 0)
            return null;
        const avg = (pick) => round2(res.cows.reduce((s, c) => s + pick(c), 0) / res.cows.length);
        return {
            basis,
            headcount: res.cows.length,
            captured_at: new Date().toISOString(),
            dm_kg: avg((c) => c.requirements.dm_kg),
            cp_kg: avg((c) => c.requirements.cp_kg),
            me_mj: avg((c) => c.requirements.me_mj),
        };
    }
    mapConflict(e) {
        if (e instanceof client_1.Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2002') {
            return new common_1.ConflictException('A feed plan with this name already exists — pick another name');
        }
        return e;
    }
    mapPlan(plan, names, appliedTo) {
        const lines = plan.lines.map((l) => ({
            id: l.id,
            line_type: l.lineType,
            feed_item_id: l.feedItemId,
            concentration_id: l.concentrationId,
            name: l.feedItemId
                ? (names.items.get(l.feedItemId) ?? null)
                : (names.recipes.get(l.concentrationId)?.name ?? null),
            recipe_kind: l.concentrationId
                ? (names.recipes.get(l.concentrationId)?.kind ?? null)
                : null,
            kg_per_day: l.kgPerDay,
            sort_order: l.sortOrder,
        }));
        return {
            id: plan.id,
            name: plan.name,
            kind: plan.kind,
            notes: plan.notes,
            made_for_cattle_id: plan.madeForCattleId,
            made_for_animal_group_id: plan.madeForAnimalGroupId,
            reference_requirement: plan.referenceRequirement,
            is_active: plan.isActive,
            applied_to: appliedTo ?? { cattle_ids: [], group_ids: [], herd: false },
            lines,
            total_kg_per_day: round2(lines.reduce((s, l) => s + l.kg_per_day, 0)),
            created_at: plan.createdAt,
            updated_at: plan.updatedAt,
        };
    }
};
exports.FeedPlanService = FeedPlanService;
exports.FeedPlanService = FeedPlanService = FeedPlanService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService,
        feed_requirements_service_1.FeedRequirementsService,
        feed_lot_resolver_service_1.FeedLotResolver,
        feed_plan_assignment_service_1.FeedPlanAssignmentService,
        feed_plan_resolver_service_1.FeedPlanResolverService])
], FeedPlanService);
//# sourceMappingURL=feed-plan.service.js.map