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
var FeedFeedingGridService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedFeedingGridService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const farm_clock_service_1 = require("src/common/farm-time/farm-clock.service");
const herd_scope_1 = require("src/modules/cattle/domain/herd-scope");
const feed_distribution_service_1 = require("./feed-distribution.service");
const feed_stock_service_1 = require("./feed-stock.service");
const feed_lot_resolver_service_1 = require("./feed-lot-resolver.service");
const feed_plan_resolver_service_1 = require("./feed-plan-resolver.service");
const feed_plan_service_1 = require("./feed-plan.service");
const feed_requirements_service_1 = require("./feed-requirements.service");
const feed_lookahead_service_1 = require("./feed-lookahead.service");
const program_fit_1 = require("../../domain/program-fit");
const feed_item_service_1 = require("src/modules/inventory/application/services/feed-item.service");
const nutrition_profile_1 = require("../../domain/nutrition-profile");
const round2 = (n) => Math.round(n * 100) / 100;
const snapshotOf = (v) => ({
    dmPct: v.dmPct,
    cpPct: v.cpPct,
    meMjPerKgDm: v.meMjPerKgDm,
    fatPct: v.fatPct,
    ndfPct: v.ndfPct,
    rdpPct: v.rdpPct,
    rupPct: v.rupPct,
    starchPct: v.starchPct,
    adfPct: v.adfPct,
    calciumPct: v.calciumPct,
    phosphorusPct: v.phosphorusPct,
    tdnPct: v.tdnPct,
});
let FeedFeedingGridService = FeedFeedingGridService_1 = class FeedFeedingGridService {
    prisma;
    feedDistribution;
    feedStock;
    feedItems;
    lotResolver;
    programs;
    planService;
    requirements;
    lookahead;
    clock;
    log;
    constructor(prisma, logger, feedDistribution, feedStock, feedItems, lotResolver, programs, planService, requirements, lookahead, clock) {
        this.prisma = prisma;
        this.feedDistribution = feedDistribution;
        this.feedStock = feedStock;
        this.feedItems = feedItems;
        this.lotResolver = lotResolver;
        this.programs = programs;
        this.planService = planService;
        this.requirements = requirements;
        this.lookahead = lookahead;
        this.clock = clock;
        this.log = logger.setContext(FeedFeedingGridService_1.name);
    }
    async calendar(farmId, month) {
        const [year, m] = month.split('-').map(Number);
        const from = new Date(Date.UTC(year, m - 1, 1));
        const to = new Date(Date.UTC(year, m, 1));
        const today = await this.clock.todayStart(farmId);
        const [farm, cattle, rows] = await Promise.all([
            this.prisma.farm.findUnique({
                where: { id: farmId },
                select: { createdAt: true },
            }),
            this.prisma.cattle.findMany({
                where: (0, herd_scope_1.activeHerd)(farmId),
                select: { id: true },
            }),
            this.prisma.feedDistributionCattleItem.findMany({
                where: {
                    voidedAt: null,
                    distribution: {
                        farmId,
                        sourceType: 'FEEDING_GRID',
                        voidedAt: null,
                        distributedAt: { gte: from, lt: to },
                    },
                },
                select: {
                    cattleId: true,
                    distribution: { select: { distributedAt: true } },
                },
            }),
        ]);
        const farmCreatedDay = farm
            ? this.dayStart(farm.createdAt.toISOString())
            : null;
        const activeIds = new Set(cattle.map((c) => c.id));
        const coverageByDay = new Map();
        for (const row of rows) {
            if (!activeIds.has(row.cattleId))
                continue;
            const key = this.dateOnly(row.distribution.distributedAt);
            const covered = coverageByDay.get(key) ?? new Set();
            covered.add(row.cattleId);
            coverageByDay.set(key, covered);
        }
        const days = [];
        for (let d = new Date(from); d < to; d = new Date(d.getTime() + 86400000)) {
            const dateStr = this.dateOnly(d);
            let status;
            if (d.getTime() > today.getTime()) {
                status = 'future';
            }
            else if (farmCreatedDay && d.getTime() < farmCreatedDay.getTime()) {
                status = 'before_farm';
            }
            else if (activeIds.size === 0) {
                status = 'missing';
            }
            else {
                const covered = coverageByDay.get(dateStr)?.size ?? 0;
                if (covered === 0)
                    status = 'missing';
                else if (covered >= activeIds.size)
                    status = 'complete';
                else
                    status = 'partial';
            }
            days.push({ date: dateStr, status });
        }
        return { month, days };
    }
    async getGrid(farmId, date) {
        const logDate = this.dayStart(date);
        const cattle = await this.prisma.cattle.findMany({
            where: (0, herd_scope_1.activeHerd)(farmId),
            select: { id: true, name: true, tagNumber: true },
            orderBy: { tagNumber: 'asc' },
        });
        const cattleIds = cattle.map((c) => c.id);
        if (cattleIds.length === 0) {
            return { date: date, sections: [], cows: [] };
        }
        const [drafts, defaults, defaultSources, confirmedToday, confirmedSupply, programByCow, requirementRes, lookaheadByCow,] = await Promise.all([
            this.prisma.feedFeedingDraft.findMany({
                where: { farmId, cattleId: { in: cattleIds }, logDate },
            }),
            this.computeDefaults(farmId, cattleIds),
            this.resolveDefaultSources(farmId, cattle),
            this.computeConfirmedToday(cattleIds, farmId, logDate),
            this.computeConfirmedSupply(cattleIds, farmId, logDate),
            this.programs.resolveForCattle(farmId, cattleIds),
            this.requirements.forCattle(farmId, cattleIds, date),
            this.lookahead.forCattle(farmId, cattleIds, logDate),
        ]);
        const draftsByCattle = this.groupByCattle(drafts);
        const requirementByCow = new Map(requirementRes.cows.map((c) => [c.cattle_id, c]));
        const sectionsById = new Map();
        const sectionOfCow = new Map();
        for (const [cowId, program] of programByCow) {
            const id = [program.planId, program.via, program.groupId ?? ''].join(':');
            const section = sectionsById.get(id) ?? { id, program, cattleIds: [] };
            section.cattleIds.push(cowId);
            sectionsById.set(id, section);
            sectionOfCow.set(cowId, id);
        }
        const totalsBySection = new Map();
        const sections = await Promise.all([...sectionsById.values()].map(async (sec) => {
            const supply = await this.planService.resolveSupply(farmId, {
                lines: sec.program.lines,
            });
            totalsBySection.set(sec.id, {
                dmKg: supply.reduce((t, l) => t + (l.supply.dm_kg ?? 0), 0),
                cpKg: supply.reduce((t, l) => t + (l.supply.cp_kg ?? 0), 0),
                meMj: supply.reduce((t, l) => t + (l.supply.me_mj ?? 0), 0),
                complete: supply.every((l) => l.density != null),
            });
            return {
                id: sec.id,
                plan_id: sec.program.planId,
                plan_name: sec.program.planName,
                kind: sec.program.kind,
                via: sec.program.via,
                group_id: sec.program.groupId ?? null,
                conflict: sec.program.conflict,
                cattle_ids: sec.cattleIds,
                lines: supply.map((l) => ({
                    line_id: l.line_id,
                    line_type: l.line_type,
                    name: l.name,
                    kg_per_day: l.kg_per_day,
                    prefill_kg: round2(l.kg_per_day),
                    source: l.source,
                    density: l.density,
                    stock_ok: l.stock_ok,
                })),
            };
        }));
        const linesBySection = new Map(sections.map((sec) => [sec.id, sec.lines]));
        const cows = cattle.map((c) => {
            const program = programByCow.get(c.id);
            const sectionId = sectionOfCow.get(c.id) ?? null;
            const req = requirementByCow.get(c.id);
            const totals = sectionId ? totalsBySection.get(sectionId) : undefined;
            const fedSoFar = confirmedSupply.get(c.id);
            const requirementAmounts = req
                ? {
                    dmKg: req.requirements.dm_kg,
                    cpKg: req.requirements.cp_kg,
                    meMj: req.requirements.me_mj,
                }
                : null;
            const remaining = requirementAmounts && fedSoFar
                ? (0, program_fit_1.remainingRequirement)(requirementAmounts, {
                    dmKg: fedSoFar.dm_kg,
                    cpKg: fedSoFar.cp_kg,
                    meMj: fedSoFar.me_mj,
                })
                : null;
            const fit = totals && requirementAmounts && req
                ? fedSoFar
                    ? (0, program_fit_1.computeRemainingFit)({ dmKg: totals.dmKg, cpKg: totals.cpKg, meMj: totals.meMj }, requirementAmounts, {
                        dmKg: fedSoFar.dm_kg,
                        cpKg: fedSoFar.cp_kg,
                        meMj: fedSoFar.me_mj,
                    }, requirementRes.bands, req.flags.length > 0 || !totals.complete || !fedSoFar.complete)
                    : (0, program_fit_1.computeProgramFit)({ dmKg: totals.dmKg, cpKg: totals.cpKg, meMj: totals.meMj }, requirementAmounts, requirementRes.bands, req.flags.length > 0 || !totals.complete)
                : null;
            return {
                planned_supply: totals
                    ? {
                        dm_kg: round2(totals.dmKg),
                        cp_kg: round2(totals.cpKg),
                        me_mj: round2(totals.meMj),
                        complete: totals.complete,
                    }
                    : null,
                fit: fit ? (0, program_fit_1.toApiFit)(fit) : null,
                cattle_id: c.id,
                name: c.name,
                tag_number: c.tagNumber,
                drafts: (draftsByCattle.get(c.id) ?? []).map((d) => this.mapDraft(d)),
                default_offered_kg: defaults.get(c.id) ?? null,
                default_source: this.mapResolvedSource(defaultSources.get(c.id)),
                confirmed_offered_kg: confirmedToday.get(c.id) ?? null,
                confirmed_supply: confirmedSupply.get(c.id) ?? null,
                remaining_requirement: remaining
                    ? {
                        dm_kg: round2(remaining.dmKg),
                        cp_kg: round2(remaining.cpKg),
                        me_mj: round2(remaining.meMj),
                    }
                    : null,
                program_section_id: sectionId,
                program_conflict: program?.conflict ?? false,
                lookahead: lookaheadByCow.get(c.id) ?? [],
                planned_kg_by_line: sectionId
                    ? Object.fromEntries((linesBySection.get(sectionId) ?? []).map((l) => [
                        l.line_id,
                        l.prefill_kg,
                    ]))
                    : {},
                requirement: req
                    ? {
                        dm_kg: req.requirements.dm_kg,
                        cp_kg: req.requirements.cp_kg,
                        me_mj: req.requirements.me_mj,
                        flags: req.flags,
                        source: req.source,
                        ...('manual' in req
                            ? {
                                dynamic_requirements: req.dynamic_requirements,
                                manual: req.manual,
                            }
                            : {}),
                    }
                    : null,
            };
        });
        const summary = new Map();
        for (const c of cows) {
            if (!c.program_section_id || !c.fit)
                continue;
            const s = summary.get(c.program_section_id) ?? {
                ok: 0,
                warn: 0,
                bad: 0,
                estimated: 0,
            };
            s[c.fit.severity] += 1;
            if (c.fit.estimated)
                s.estimated += 1;
            summary.set(c.program_section_id, s);
        }
        return {
            date,
            sections: sections.map((sec) => ({
                ...sec,
                fit_summary: summary.get(sec.id) ?? {
                    ok: 0,
                    warn: 0,
                    bad: 0,
                    estimated: 0,
                },
            })),
            cows,
        };
    }
    async saveDraft(farmId, userId, dto) {
        const logDate = this.dayStart(dto.date);
        const cattleIds = dto.entries.map((e) => e.cattleId);
        await this.assertCattleBelongToFarm(farmId, cattleIds);
        const items = [];
        for (const entry of dto.entries) {
            if (entry.lines?.length) {
                for (const l of entry.lines) {
                    items.push({
                        cattleId: entry.cattleId,
                        source: this.resolveEntrySource(dto, l),
                        offeredKg: l.offeredKg,
                        refusalKg: l.refusalKg ?? null,
                        planLineId: l.planLineId ?? null,
                    });
                }
                continue;
            }
            const source = this.resolveEntrySource(dto, entry);
            if (!source) {
                throw new common_1.BadRequestException(`Cattle ${entry.cattleId} needs a source — either its own sourceType or the call's top-level sourceType`);
            }
            items.push({
                cattleId: entry.cattleId,
                source,
                offeredKg: entry.offeredKg,
                refusalKg: entry.refusalKg ?? null,
                planLineId: null,
            });
        }
        const seen = new Set();
        for (const it of items) {
            const key = `${it.cattleId}|${this.sourceKey(it.source)}`;
            if (seen.has(key)) {
                throw new common_1.BadRequestException(`Cattle ${it.cattleId} lists the same feed twice — combine the quantities into one line`);
            }
            seen.add(key);
        }
        const distinctSources = new Map();
        for (const { source } of items) {
            distinctSources.set(this.sourceKey(source), source);
        }
        for (const source of distinctSources.values()) {
            await this.validateSource(farmId, source);
        }
        const write = () => this.prisma.$transaction(async (tx) => {
            const rows = [];
            for (const it of items) {
                const where = {
                    farmId,
                    cattleId: it.cattleId,
                    logDate,
                    sourceType: it.source.sourceType,
                    feedItemId: it.source.feedItemId,
                    feedStockId: it.source.feedStockId,
                };
                const existing = await tx.feedFeedingDraft.findFirst({ where });
                rows.push(existing
                    ? await tx.feedFeedingDraft.update({
                        where: { id: existing.id },
                        data: {
                            offeredKg: round2(it.offeredKg),
                            ...(it.refusalKg != null && {
                                refusalKg: round2(it.refusalKg),
                            }),
                            ...(it.planLineId != null && {
                                feedPlanLineId: it.planLineId,
                            }),
                        },
                    })
                    : await tx.feedFeedingDraft.create({
                        data: {
                            ...where,
                            offeredKg: round2(it.offeredKg),
                            refusalKg: it.refusalKg != null ? round2(it.refusalKg) : null,
                            feedPlanLineId: it.planLineId,
                            createdBy: userId,
                        },
                    }));
            }
            return rows;
        });
        let saved;
        try {
            saved = await write();
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                e.code === 'P2002') {
                saved = await write();
            }
            else {
                throw e;
            }
        }
        this.log.info('Feeding grid draft saved', {
            farmId,
            date: dto.date,
            sources: distinctSources.size,
            entries: saved.length,
        });
        return { saved: saved.length, drafts: saved.map((d) => this.mapDraft(d)) };
    }
    async confirm(farmId, userId, dto) {
        const logDate = this.dayStart(dto.date);
        const cattle = await this.prisma.cattle.findMany({
            where: (0, herd_scope_1.activeHerd)(farmId),
            select: { id: true },
        });
        const cattleIds = cattle.map((c) => c.id);
        if (cattleIds.length === 0) {
            throw new common_1.BadRequestException('No cattle in scope to confirm feeding for');
        }
        const entriesMap = new Map((dto.entries ?? []).map((e) => [e.cattleId, e]));
        const dtoDefaultSource = dto.sourceType
            ? this.resolveEntrySource(dto, {})
            : null;
        const [drafts, defaults] = await Promise.all([
            this.prisma.feedFeedingDraft.findMany({
                where: { farmId, cattleId: { in: cattleIds }, logDate },
            }),
            this.computeDefaults(farmId, cattleIds),
        ]);
        const draftsByCattle = this.groupByCattle(drafts);
        const scopedCattleIds = entriesMap.size > 0
            ? cattleIds.filter((id) => entriesMap.has(id))
            : cattleIds;
        const lines = [];
        for (const cattleId of scopedCattleIds) {
            const entry = entriesMap.get(cattleId);
            if (entry) {
                if (entry.lines?.length) {
                    const totalOffered = entry.lines.reduce((s, l) => s + l.offeredKg, 0);
                    const perLine = entry.lines.some((l) => l.refusalKg != null);
                    for (const el of entry.lines) {
                        const source = this.resolveEntrySource(dto, el);
                        const qty = round2(el.offeredKg);
                        if (!source || qty <= 0)
                            continue;
                        const refusalKg = perLine
                            ? round2(el.refusalKg ?? 0)
                            : totalOffered > 0
                                ? round2((entry.refusalKg ?? 0) * (el.offeredKg / totalOffered))
                                : 0;
                        lines.push({
                            cattleId,
                            offeredKg: qty,
                            refusalKg,
                            source,
                            planLineId: el.planLineId ?? null,
                        });
                    }
                    continue;
                }
                const source = this.resolveEntrySource(dto, entry);
                const qty = round2(entry.offeredKg);
                const refusalKg = round2(entry.refusalKg ?? 0);
                if (source && qty > 0)
                    lines.push({ cattleId, offeredKg: qty, refusalKg, source });
                continue;
            }
            const cowDrafts = draftsByCattle.get(cattleId) ?? [];
            if (cowDrafts.length > 1 && cowDrafts.some((d) => d.feedPlanLineId)) {
                for (const d of cowDrafts) {
                    const qty = round2(d.offeredKg);
                    if (qty <= 0)
                        continue;
                    lines.push({
                        cattleId,
                        offeredKg: qty,
                        refusalKg: round2(d.refusalKg ?? 0),
                        source: {
                            sourceType: d.sourceType,
                            feedItemId: d.feedItemId,
                            feedStockId: d.feedStockId,
                        },
                        planLineId: d.feedPlanLineId,
                    });
                }
                continue;
            }
            const matchingDraft = dtoDefaultSource
                ? cowDrafts.find((d) => d.sourceType === dtoDefaultSource.sourceType &&
                    d.feedItemId === dtoDefaultSource.feedItemId &&
                    d.feedStockId === dtoDefaultSource.feedStockId)
                : undefined;
            const chosenDraft = matchingDraft ?? (cowDrafts.length === 1 ? cowDrafts[0] : undefined);
            if (chosenDraft) {
                const qty = round2(chosenDraft.offeredKg);
                if (qty > 0) {
                    lines.push({
                        cattleId,
                        offeredKg: qty,
                        refusalKg: round2(chosenDraft.refusalKg ?? 0),
                        source: {
                            sourceType: chosenDraft.sourceType,
                            feedItemId: chosenDraft.feedItemId,
                            feedStockId: chosenDraft.feedStockId,
                        },
                        planLineId: chosenDraft.feedPlanLineId,
                    });
                }
                continue;
            }
            if (dtoDefaultSource) {
                const qty = round2(defaults.get(cattleId) ?? 0);
                if (qty > 0) {
                    lines.push({
                        cattleId,
                        offeredKg: qty,
                        refusalKg: 0,
                        source: dtoDefaultSource,
                    });
                }
            }
        }
        if (lines.length === 0) {
            throw new common_1.BadRequestException('No determinable quantity/source for any cow in scope');
        }
        const planLineIds = [
            ...new Set(lines.map((l) => l.planLineId).filter((id) => !!id)),
        ];
        if (planLineIds.length > 0) {
            const planRows = await this.prisma.feedPlanLine.findMany({
                where: { farmId, id: { in: planLineIds } },
                select: { id: true, planId: true, kgPerDay: true },
            });
            const snap = new Map(planRows.map((r) => [
                r.id,
                {
                    planId: r.planId,
                    planLineId: r.id,
                    plannedKg: round2(r.kgPerDay),
                },
            ]));
            for (const l of lines) {
                l.plan = l.planLineId ? (snap.get(l.planLineId) ?? null) : null;
            }
        }
        const groups = new Map();
        for (const line of lines) {
            const key = this.sourceKey(line.source);
            const group = groups.get(key) ?? { source: line.source, lines: [] };
            group.lines.push(line);
            groups.set(key, group);
        }
        const groupPlans = await Promise.all([...groups.values()].map(async ({ source, lines: groupLines }) => {
            const totalKg = round2(groupLines.reduce((sum, l) => sum + l.offeredKg, 0));
            const totalRefusalKg = round2(groupLines.reduce((sum, l) => sum + l.refusalKg, 0));
            const plan = await this.resolveGroupPlan(farmId, userId, source, totalKg);
            return { source, lines: groupLines, totalKg, totalRefusalKg, ...plan };
        }));
        const totalKg = round2(groupPlans.reduce((sum, g) => sum + g.totalKg, 0));
        const created = await this.prisma.$transaction(async (tx) => {
            const cowPieces = [];
            const lotLines = [];
            for (const g of groupPlans) {
                if (g.source.sourceType !== 'FEED_ITEM') {
                    lotLines.push({
                        ingredientId: g.ingredientId,
                        ingredientName: g.ingredientName,
                        kg: g.totalKg,
                        refusalKg: g.totalRefusalKg,
                        costTk: round2(g.totalKg * g.pricePerKg),
                        snapshot: g.nutritionSnapshot,
                        feedItemBatchId: null,
                        nutritionProfileId: null,
                    });
                    for (const l of g.lines) {
                        cowPieces.push({
                            cattleId: l.cattleId,
                            offeredKg: l.offeredKg,
                            refusalKg: l.refusalKg,
                            source: l.source,
                            costTk: round2(l.offeredKg * g.pricePerKg),
                            feedName: g.ingredientName,
                            snapshot: g.nutritionSnapshot,
                            feedItemBatchId: null,
                            nutritionProfileId: null,
                            draw: null,
                            plan: l.plan ?? null,
                        });
                    }
                    continue;
                }
                const usage = await this.feedDistribution.computeFeedItemUsage(farmId, g.source.feedItemId, g.totalKg, tx);
                const { kgPerUnit } = usage.plan;
                const lots = usage.plan.pieces.map((p) => ({
                    ...p,
                    remainingUnits: p.quantityUnits,
                    kg: 0,
                    refusalKg: 0,
                    costTk: 0,
                }));
                for (const l of g.lines) {
                    let needUnits = l.offeredKg / kgPerUnit;
                    while (needUnits > 1e-9) {
                        const lot = lots.find((x) => x.remainingUnits > 1e-9);
                        if (!lot)
                            break;
                        const takeUnits = Math.min(needUnits, lot.remainingUnits);
                        const kg = takeUnits * kgPerUnit;
                        const share = l.offeredKg > 0 ? kg / l.offeredKg : 0;
                        const cost = takeUnits * lot.costPerUnit;
                        cowPieces.push({
                            cattleId: l.cattleId,
                            offeredKg: round2(kg),
                            refusalKg: round2(l.refusalKg * share),
                            source: l.source,
                            costTk: round2(cost),
                            feedName: g.ingredientName,
                            snapshot: snapshotOf(this.lotResolver.toValues(lot.profile)),
                            feedItemBatchId: lot.batchId,
                            nutritionProfileId: lot.nutritionProfileId,
                            draw: { batchId: lot.batchId, units: takeUnits },
                            plan: l.plan
                                ? { ...l.plan, plannedKg: round2(l.plan.plannedKg * share) }
                                : null,
                        });
                        lot.remainingUnits -= takeUnits;
                        lot.kg += kg;
                        lot.refusalKg += l.refusalKg * share;
                        lot.costTk += cost;
                        needUnits -= takeUnits;
                    }
                }
                for (const lot of lots) {
                    if (lot.kg <= 0)
                        continue;
                    lotLines.push({
                        ingredientId: g.ingredientId,
                        ingredientName: g.ingredientName,
                        kg: round2(lot.kg),
                        refusalKg: round2(lot.refusalKg),
                        costTk: round2(lot.costTk),
                        snapshot: snapshotOf(this.lotResolver.toValues(lot.profile)),
                        feedItemBatchId: lot.batchId,
                        nutritionProfileId: lot.nutritionProfileId,
                    });
                }
            }
            const actualCost = round2(lotLines.reduce((s, l) => s + l.costTk, 0));
            const dist = await tx.feedDistribution.create({
                data: {
                    farmId,
                    concentrationId: null,
                    sourceType: 'FEEDING_GRID',
                    cattleId: null,
                    distributedAt: logDate,
                    totalPlannedKg: totalKg,
                    totalActualKg: totalKg,
                    totalRefusalKg: round2(groupPlans.reduce((sum, g) => sum + g.totalRefusalKg, 0)),
                    totalPlannedCost: actualCost,
                    totalActualCost: actualCost,
                    createdBy: userId,
                    items: {
                        create: lotLines.map((l) => ({
                            ingredientId: l.ingredientId,
                            ingredientName: l.ingredientName,
                            plannedKg: l.kg,
                            actualKg: l.kg,
                            refusalKg: l.refusalKg,
                            pricePerKg: l.kg > 0 ? round2(l.costTk / l.kg) : 0,
                            lineCost: l.costTk,
                            feedItemBatchId: l.feedItemBatchId,
                            nutritionProfileId: l.nutritionProfileId,
                            ...(l.snapshot ?? {}),
                        })),
                    },
                },
                include: { items: true },
            });
            const cattleItems = [];
            for (const p of cowPieces) {
                const row = await tx.feedDistributionCattleItem.create({
                    data: {
                        distributionId: dist.id,
                        cattleId: p.cattleId,
                        offeredKg: p.offeredKg,
                        refusalKg: p.refusalKg,
                        sourceType: p.source.sourceType,
                        feedItemId: p.source.feedItemId,
                        feedStockId: p.source.feedStockId,
                        costTk: p.costTk,
                        feedName: p.feedName,
                        feedItemBatchId: p.feedItemBatchId,
                        nutritionProfileId: p.nutritionProfileId,
                        feedPlanId: p.plan?.planId ?? null,
                        feedPlanLineId: p.plan?.planLineId ?? null,
                        plannedKg: p.plan?.plannedKg ?? null,
                        ...(p.snapshot ?? {}),
                    },
                });
                cattleItems.push(row);
                if (p.draw && p.source.feedItemId) {
                    await this.feedItems.applyFeedDraw(farmId, userId, p.source.feedItemId, {
                        batchId: p.draw.batchId,
                        quantityUnits: p.draw.units,
                        distributionId: dist.id,
                        cattleItemId: row.id,
                    }, tx);
                }
            }
            for (const { source, lines: groupLines } of groups.values()) {
                await tx.feedFeedingDraft.deleteMany({
                    where: {
                        farmId,
                        logDate,
                        sourceType: source.sourceType,
                        feedItemId: source.feedItemId,
                        feedStockId: source.feedStockId,
                        cattleId: { in: groupLines.map((l) => l.cattleId) },
                    },
                });
            }
            for (const g of groupPlans)
                await g.applyStock(dist.id, tx);
            return { ...dist, cattleItems };
        });
        this.log.info('Feeding grid confirmed', {
            farmId,
            distributionId: created.id,
            date: dto.date,
            sources: groupPlans.length,
            cows: lines.length,
            totalKg,
        });
        return {
            id: created.id,
            date: dto.date,
            total_actual_kg: created.totalActualKg,
            total_actual_cost: created.totalActualCost,
            sources: groupPlans.map((g) => ({
                source_type: g.source.sourceType,
                feed_item_id: g.source.feedItemId,
                feed_stock_id: g.source.feedStockId,
                total_kg: g.totalKg,
            })),
            cows: [
                ...created.cattleItems
                    .reduce((byCow, c) => {
                    const prev = byCow.get(c.cattleId);
                    byCow.set(c.cattleId, {
                        cattle_id: c.cattleId,
                        offered_kg: round2((prev?.offered_kg ?? 0) + c.offeredKg),
                        refusal_kg: round2((prev?.refusal_kg ?? 0) + c.refusalKg),
                        source_type: c.sourceType,
                        feed_item_id: c.feedItemId,
                        feed_stock_id: c.feedStockId,
                        cost_tk: round2((prev?.cost_tk ?? 0) + (c.costTk ?? 0)),
                    });
                    return byCow;
                }, new Map())
                    .values(),
            ],
        };
    }
    async validateSource(farmId, source) {
        if (source.sourceType === 'FEED_ITEM') {
            const item = await this.prisma.feedItem.findFirst({
                where: { id: source.feedItemId ?? undefined, farmId, deletedAt: null },
                select: { id: true },
            });
            if (!item)
                throw new common_1.NotFoundException('Feed item not found');
        }
        else {
            const stock = await this.prisma.feedStock.findFirst({
                where: { id: source.feedStockId ?? undefined, farmId, deletedAt: null },
                select: { id: true },
            });
            if (!stock)
                throw new common_1.NotFoundException('Feed stock lot not found');
        }
    }
    resolveEntrySource(dto, entry) {
        const sourceType = entry.sourceType ?? dto.sourceType;
        if (!sourceType)
            return null;
        const from = entry.sourceType ? entry : dto;
        return {
            sourceType,
            feedItemId: sourceType === 'FEED_ITEM' ? (from.feedItemId ?? null) : null,
            feedStockId: sourceType === 'FEED_STOCK' ? (from.feedStockId ?? null) : null,
        };
    }
    sourceKey(source) {
        return `${source.sourceType}:${source.feedItemId ?? source.feedStockId}`;
    }
    async resolveGroupPlan(farmId, userId, source, totalKg) {
        if (source.sourceType === 'FEED_ITEM') {
            const usage = await this.feedDistribution.computeFeedItemUsage(farmId, source.feedItemId, totalKg);
            const nutritionSnapshot = snapshotOf((0, nutrition_profile_1.blendNutrition)(usage.plan.pieces.map((p) => ({
                kg: p.quantityKg,
                values: this.lotResolver.toValues(p.profile),
            }))));
            return {
                ingredientId: usage.ingredientId,
                ingredientName: usage.ingredientName,
                pricePerKg: usage.pricePerKg,
                nutritionSnapshot,
                applyStock: async () => { },
            };
        }
        const stock = await this.prisma.feedStock.findFirst({
            where: { id: source.feedStockId ?? undefined, farmId, deletedAt: null },
            include: { nutritionProfile: true },
        });
        if (!stock)
            throw new common_1.NotFoundException('Feed stock lot not found');
        const p = stock.nutritionProfile;
        await this.feedStock.assertSufficientStock(farmId, [
            { stockId: stock.id, quantity: totalKg },
        ]);
        const nutritionSnapshot = snapshotOf(this.lotResolver.toValues(p));
        const recipe = await this.prisma.feedConcentration.findFirst({
            where: { id: stock.sourceConcentrationId },
            select: { name: true },
        });
        return {
            ingredientId: stock.sourceConcentrationId,
            ingredientName: recipe?.name ?? `Batch ${stock.id}`,
            pricePerKg: stock.producedQtyKg > 0
                ? round2(stock.producedCostTk / stock.producedQtyKg)
                : 0,
            nutritionSnapshot,
            applyStock: async (distributionId, tx) => {
                await this.feedStock.decrementForDistribution(farmId, userId, { stockId: stock.id, quantity: totalKg, distributionId }, tx);
            },
        };
    }
    async cattleHistory(farmId, cattleId, date) {
        const found = await this.prisma.cattle.findFirst({
            where: { id: cattleId, farmId },
            select: { id: true },
        });
        if (!found)
            throw new common_1.NotFoundException('Cattle not found');
        const logDate = await this.clock.dayStart(farmId, date);
        const rows = await this.prisma.feedDistributionCattleItem.findMany({
            where: {
                cattleId,
                distribution: {
                    farmId,
                    distributedAt: logDate,
                    sourceType: 'FEEDING_GRID',
                },
            },
            include: { distribution: { select: { createdAt: true } } },
            orderBy: { id: 'desc' },
        });
        const active = rows.filter((r) => r.voidedAt == null);
        const dmKgOf = (r) => r.dmPct == null ? null : r.offeredKg * (r.dmPct / 100);
        const sumPctOfDm = (pctField) => active.reduce((sum, r) => {
            const dm = dmKgOf(r);
            const pct = r[pctField];
            if (dm == null || pct == null)
                return sum;
            return sum + dm * (pct / 100);
        }, 0);
        const totalDmKg = active.reduce((sum, r) => sum + (dmKgOf(r) ?? 0), 0);
        const totalMeMj = active.reduce((sum, r) => {
            const dm = dmKgOf(r);
            if (dm == null || r.meMjPerKgDm == null)
                return sum;
            return sum + dm * r.meMjPerKgDm;
        }, 0);
        const rdpRup = active.reduce((acc, r) => {
            const dm = dmKgOf(r);
            if (dm == null || r.cpPct == null)
                return acc;
            const cpKgLine = dm * (r.cpPct / 100);
            if (r.rdpPct != null)
                acc.rdp += cpKgLine * (r.rdpPct / 100);
            if (r.rupPct != null)
                acc.rup += cpKgLine * (r.rupPct / 100);
            return acc;
        }, { rdp: 0, rup: 0 });
        const anyMeasured = (pctField) => active.some((r) => r.dmPct != null && r[pctField] != null);
        const measured = {
            dm_kg: active.some((r) => r.dmPct != null),
            cp_kg: anyMeasured('cpPct'),
            me_mj: active.some((r) => r.dmPct != null && r.meMjPerKgDm != null),
            fat_kg: anyMeasured('fatPct'),
            ndf_kg: anyMeasured('ndfPct'),
            adf_kg: anyMeasured('adfPct'),
            starch_kg: anyMeasured('starchPct'),
            tdn_kg: anyMeasured('tdnPct'),
            calcium_kg: anyMeasured('calciumPct'),
            phosphorus_kg: anyMeasured('phosphorusPct'),
            rdp_kg: active.some((r) => r.cpPct != null && r.rdpPct != null),
            rup_kg: active.some((r) => r.cpPct != null && r.rupPct != null),
        };
        const dateKey = this.dateOnly(logDate);
        const required = (await this.requirements.forCattle(farmId, [cattleId], dateKey)).cows[0];
        return {
            cattle_id: cattleId,
            date: dateKey,
            requirement: required
                ? { ...required.requirements, source: required.source }
                : null,
            measured,
            entries: rows.map((r) => ({
                id: r.id,
                distribution_id: r.distributionId,
                offered_kg: r.offeredKg,
                refusal_kg: r.refusalKg,
                cost_tk: r.costTk,
                feed_name: r.feedName,
                source_type: r.sourceType,
                fed_at: r.distribution.createdAt,
                voided_at: r.voidedAt,
                voided_by: r.voidedBy,
                void_reason: r.voidReason,
            })),
            totals: {
                dm_kg: round2(totalDmKg),
                cp_kg: round2(sumPctOfDm('cpPct')),
                me_mj: round2(totalMeMj),
                fat_kg: round2(sumPctOfDm('fatPct')),
                ndf_kg: round2(sumPctOfDm('ndfPct')),
                adf_kg: round2(sumPctOfDm('adfPct')),
                starch_kg: round2(sumPctOfDm('starchPct')),
                tdn_kg: round2(sumPctOfDm('tdnPct')),
                calcium_kg: round2(sumPctOfDm('calciumPct')),
                phosphorus_kg: round2(sumPctOfDm('phosphorusPct')),
                rdp_kg: round2(rdpRup.rdp),
                rup_kg: round2(rdpRup.rup),
            },
        };
    }
    async voidCattleItem(farmId, userId, distributionId, cattleItemId, dto) {
        const item = await this.prisma.feedDistributionCattleItem.findFirst({
            where: { id: cattleItemId, distributionId, distribution: { farmId } },
            include: {
                distribution: { include: { items: true, cattleItems: true } },
            },
        });
        if (!item)
            throw new common_1.NotFoundException('Feeding record not found');
        if (item.voidedAt) {
            return {
                id: item.id,
                cattle_id: item.cattleId,
                offered_kg: item.offeredKg,
                voided_at: item.voidedAt,
                voided_by: item.voidedBy,
                void_reason: item.voidReason,
            };
        }
        const dist = item.distribution;
        const costTk = item.costTk ?? 0;
        let siblingItem = item.feedItemBatchId
            ? dist.items.find((i) => i.feedItemBatchId === item.feedItemBatchId)
            : undefined;
        if (!siblingItem) {
            let ingredientId;
            if (item.sourceType === 'FEED_ITEM') {
                const feedItem = await this.prisma.feedItem.findFirst({
                    where: { id: item.feedItemId ?? undefined, farmId },
                    select: { id: true, ingredientId: true },
                });
                if (!feedItem)
                    throw new common_1.NotFoundException('Feed item not found');
                ingredientId = feedItem.ingredientId ?? feedItem.id;
            }
            else {
                const stock = await this.prisma.feedStock.findFirst({
                    where: { id: item.feedStockId ?? undefined, farmId },
                    select: { sourceConcentrationId: true },
                });
                if (!stock)
                    throw new common_1.NotFoundException('Feed stock lot not found');
                ingredientId = stock.sourceConcentrationId;
            }
            siblingItem = dist.items.find((i) => i.ingredientId === ingredientId);
        }
        if (!siblingItem) {
            throw new common_1.NotFoundException('Distribution line not found');
        }
        const sibling = siblingItem;
        const result = await this.prisma.$transaction(async (tx) => {
            const applied = await tx.feedDistributionCattleItem.updateMany({
                where: { id: item.id, voidedAt: null },
                data: {
                    voidedAt: new Date(),
                    voidedBy: userId,
                    voidReason: dto.reason ?? null,
                },
            });
            if (applied.count === 0) {
                return this.prisma.feedDistributionCattleItem.findUniqueOrThrow({
                    where: { id: item.id },
                });
            }
            if (item.sourceType === 'FEED_ITEM' && item.feedItemId) {
                await this.feedItems.restoreFeedDraw(farmId, userId, {
                    cattleItemId: item.id,
                    fallbackFeedItemId: item.feedItemId,
                    fallbackQuantityKg: item.offeredKg,
                    notes: dto.reason ?? 'Feeding voided',
                }, tx);
            }
            else if (item.sourceType === 'FEED_STOCK' && item.feedStockId) {
                await tx.feedStock.update({
                    where: { id: item.feedStockId },
                    data: { currentStockKg: { increment: item.offeredKg } },
                });
                await tx.feedStockMovement.create({
                    data: {
                        stockId: item.feedStockId,
                        changeKg: round2(item.offeredKg),
                        reason: 'ADJUSTMENT',
                        distributionId: dist.id,
                        createdBy: userId,
                    },
                });
            }
            await tx.feedDistributionItem.update({
                where: { id: sibling.id },
                data: {
                    actualKg: round2(sibling.actualKg - item.offeredKg),
                    refusalKg: round2(sibling.refusalKg - item.refusalKg),
                    lineCost: round2(sibling.lineCost - costTk),
                },
            });
            await tx.feedDistribution.update({
                where: { id: dist.id },
                data: {
                    totalActualKg: round2(dist.totalActualKg - item.offeredKg),
                    totalRefusalKg: round2(dist.totalRefusalKg - item.refusalKg),
                    totalActualCost: round2(dist.totalActualCost - costTk),
                },
            });
            const remainingActive = dist.cattleItems.filter((c) => c.id !== item.id && c.voidedAt == null);
            if (remainingActive.length === 0) {
                await tx.feedDistribution.update({
                    where: { id: dist.id },
                    data: { voidedAt: new Date() },
                });
            }
            return tx.feedDistributionCattleItem.findUniqueOrThrow({
                where: { id: item.id },
            });
        });
        this.log.info('Feeding grid cattle item voided', {
            farmId,
            distributionId,
            cattleItemId,
            offeredKg: item.offeredKg,
            costTk,
        });
        return {
            id: result.id,
            cattle_id: result.cattleId,
            offered_kg: result.offeredKg,
            voided_at: result.voidedAt,
            voided_by: result.voidedBy,
            void_reason: result.voidReason,
        };
    }
    async assertCattleBelongToFarm(farmId, cattleIds) {
        const ids = [...new Set(cattleIds)];
        const found = await this.prisma.cattle.count({
            where: { id: { in: ids }, ...(0, herd_scope_1.activeHerd)(farmId) },
        });
        if (found !== ids.length) {
            throw new common_1.BadRequestException('One or more cattle do not belong to this farm');
        }
    }
    async computeDefaults(farmId, cattleIds) {
        const rows = await this.prisma.feedDistributionCattleItem.findMany({
            where: {
                cattleId: { in: cattleIds },
                voidedAt: null,
                distribution: { farmId, voidedAt: null },
            },
            select: {
                cattleId: true,
                offeredKg: true,
                distribution: { select: { distributedAt: true } },
            },
            orderBy: { distribution: { distributedAt: 'desc' } },
        });
        const map = new Map();
        for (const row of rows) {
            if (!map.has(row.cattleId))
                map.set(row.cattleId, row.offeredKg);
        }
        return map;
    }
    async computeConfirmedToday(cattleIds, farmId, logDate) {
        const rows = await this.prisma.feedDistributionCattleItem.findMany({
            where: {
                cattleId: { in: cattleIds },
                voidedAt: null,
                distribution: { farmId, distributedAt: logDate, voidedAt: null },
            },
            select: { cattleId: true, offeredKg: true },
        });
        const map = new Map();
        for (const row of rows) {
            map.set(row.cattleId, round2((map.get(row.cattleId) ?? 0) + row.offeredKg));
        }
        return map;
    }
    async computeConfirmedSupply(cattleIds, farmId, logDate) {
        const rows = await this.prisma.feedDistributionCattleItem.findMany({
            where: {
                cattleId: { in: cattleIds },
                voidedAt: null,
                distribution: { farmId, distributedAt: logDate, voidedAt: null },
            },
            select: { cattleId: true, offeredKg: true, nutritionProfileId: true },
        });
        const profiles = await this.lotResolver.profiles(farmId, rows.flatMap((r) => (r.nutritionProfileId ? [r.nutritionProfileId] : [])));
        const acc = new Map();
        for (const row of rows) {
            const cur = acc.get(row.cattleId) ?? {
                dm_kg: 0,
                cp_kg: 0,
                me_mj: 0,
                complete: true,
            };
            const p = row.nutritionProfileId
                ? profiles.get(row.nutritionProfileId)
                : undefined;
            if (!p) {
                cur.complete = false;
            }
            else {
                const dm = row.offeredKg * (p.dmPct / 100);
                cur.dm_kg += dm;
                cur.cp_kg += dm * (p.cpPct / 100);
                cur.me_mj += dm * p.meMjPerKgDm;
            }
            acc.set(row.cattleId, cur);
        }
        for (const v of acc.values()) {
            v.dm_kg = round2(v.dm_kg);
            v.cp_kg = round2(v.cp_kg);
            v.me_mj = round2(v.me_mj);
        }
        return acc;
    }
    mapResolvedSource(source) {
        if (!source)
            return null;
        return {
            source_type: source.sourceType,
            feed_item_id: source.feedItemId,
            feed_stock_id: source.feedStockId,
        };
    }
    async resolveDefaultSources(farmId, cattle) {
        const cattleIds = cattle.map((c) => c.id);
        const lastUsedByCattle = await this.computeLastUsedSources(farmId, cattleIds);
        const feedItemIds = new Set();
        const feedStockIds = new Set();
        for (const lu of lastUsedByCattle.values()) {
            if (lu.feedItemId)
                feedItemIds.add(lu.feedItemId);
            if (lu.feedStockId)
                feedStockIds.add(lu.feedStockId);
        }
        const [items, stocks] = await Promise.all([
            this.prisma.feedItem.findMany({
                where: { id: { in: [...feedItemIds] }, farmId },
                select: {
                    id: true,
                    deletedAt: true,
                    batches: {
                        where: { deletedAt: null },
                        select: { currentStock: true },
                    },
                },
            }),
            this.prisma.feedStock.findMany({
                where: { id: { in: [...feedStockIds] }, farmId },
                select: {
                    id: true,
                    currentStockKg: true,
                    deletedAt: true,
                    sourceConcentrationId: true,
                },
            }),
        ]);
        const itemMap = new Map(items.map((i) => [i.id, i]));
        const stockMap = new Map(stocks.map((s) => [s.id, s]));
        const exhaustedRecipeIds = new Set();
        for (const stock of stocks) {
            if (stock.deletedAt || stock.currentStockKg <= 0) {
                exhaustedRecipeIds.add(stock.sourceConcentrationId);
            }
        }
        const siblingsByRecipe = new Map();
        if (exhaustedRecipeIds.size) {
            const siblings = await this.prisma.feedStock.findMany({
                where: {
                    farmId,
                    sourceConcentrationId: { in: [...exhaustedRecipeIds] },
                    deletedAt: null,
                    currentStockKg: { gt: 0 },
                },
                select: { id: true, sourceConcentrationId: true },
                orderBy: { producedAt: 'desc' },
            });
            for (const s of siblings) {
                if (!siblingsByRecipe.has(s.sourceConcentrationId)) {
                    siblingsByRecipe.set(s.sourceConcentrationId, { id: s.id });
                }
            }
        }
        const result = new Map();
        for (const c of cattle) {
            const lastUsed = lastUsedByCattle.get(c.id);
            if (lastUsed?.sourceType === 'FEED_ITEM') {
                const item = lastUsed.feedItemId
                    ? itemMap.get(lastUsed.feedItemId)
                    : undefined;
                if (item &&
                    !item.deletedAt &&
                    item.batches.some((b) => b.currentStock > 0)) {
                    result.set(c.id, {
                        sourceType: 'FEED_ITEM',
                        feedItemId: lastUsed.feedItemId,
                        feedStockId: null,
                    });
                    continue;
                }
            }
            else if (lastUsed?.sourceType === 'FEED_STOCK') {
                const stock = lastUsed.feedStockId
                    ? stockMap.get(lastUsed.feedStockId)
                    : undefined;
                if (stock && !stock.deletedAt && stock.currentStockKg > 0) {
                    result.set(c.id, {
                        sourceType: 'FEED_STOCK',
                        feedItemId: null,
                        feedStockId: lastUsed.feedStockId,
                    });
                    continue;
                }
                const sibling = stock
                    ? siblingsByRecipe.get(stock.sourceConcentrationId)
                    : undefined;
                if (sibling) {
                    result.set(c.id, {
                        sourceType: 'FEED_STOCK',
                        feedItemId: null,
                        feedStockId: sibling.id,
                    });
                    continue;
                }
            }
            result.set(c.id, null);
        }
        return result;
    }
    async computeLastUsedSources(farmId, cattleIds) {
        const rows = await this.prisma.feedDistributionCattleItem.findMany({
            where: {
                cattleId: { in: cattleIds },
                distribution: { farmId },
                sourceType: { not: null },
            },
            select: {
                cattleId: true,
                sourceType: true,
                feedItemId: true,
                feedStockId: true,
                distribution: { select: { distributedAt: true } },
            },
            orderBy: { distribution: { distributedAt: 'desc' } },
        });
        const map = new Map();
        for (const row of rows) {
            if (!map.has(row.cattleId) && row.sourceType) {
                map.set(row.cattleId, {
                    sourceType: row.sourceType,
                    feedItemId: row.feedItemId,
                    feedStockId: row.feedStockId,
                });
            }
        }
        return map;
    }
    groupByCattle(rows) {
        const map = new Map();
        for (const row of rows) {
            const list = map.get(row.cattleId) ?? [];
            list.push(row);
            map.set(row.cattleId, list);
        }
        return map;
    }
    mapDraft(row) {
        return {
            id: row.id,
            source_type: row.sourceType,
            feed_item_id: row.feedItemId,
            feed_stock_id: row.feedStockId,
            offered_kg: row.offeredKg,
            refusal_kg: row.refusalKg,
            plan_line_id: row.feedPlanLineId,
            updated_at: row.updatedAt,
        };
    }
    dayStart(dateStr) {
        const d = new Date(dateStr);
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }
    dateOnly(day) {
        return day.toISOString().slice(0, 10);
    }
};
exports.FeedFeedingGridService = FeedFeedingGridService;
exports.FeedFeedingGridService = FeedFeedingGridService = FeedFeedingGridService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService,
        feed_distribution_service_1.FeedDistributionService,
        feed_stock_service_1.FeedStockService,
        feed_item_service_1.FeedItemService,
        feed_lot_resolver_service_1.FeedLotResolver,
        feed_plan_resolver_service_1.FeedPlanResolverService,
        feed_plan_service_1.FeedPlanService,
        feed_requirements_service_1.FeedRequirementsService,
        feed_lookahead_service_1.FeedLookaheadService,
        farm_clock_service_1.FarmClockService])
], FeedFeedingGridService);
//# sourceMappingURL=feed-feeding-grid.service.js.map