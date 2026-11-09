"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CATEGORY_RULES = exports.CATTLE_CATEGORIES = void 0;
exports.categoriesOf = categoriesOf;
exports.CATTLE_CATEGORIES = [
    'ALL',
    'MALE',
    'FEMALE',
    'COW',
    'HEIFER',
    'WEANED',
    'CALF',
    'PREGNANT',
    'MILKING',
    'DRY',
    'FRESH',
    'OPEN',
    'FATTENING',
];
const DAY_MS = 24 * 60 * 60 * 1000;
const ageDays = (a, now) => a.dateOfBirth
    ? Math.floor((now.getTime() - a.dateOfBirth.getTime()) / DAY_MS)
    : null;
const ago = (ctx, days) => new Date(ctx.now.getTime() - days * DAY_MS);
const youngerThan = (ctx, days) => ({
    dateOfBirth: { gt: ago(ctx, days) },
});
const isCalf = (a, c) => {
    const age = ageDays(a, c.now);
    return age !== null && age < c.weaningDays;
};
const notCalfWhere = (ctx) => ({
    OR: [
        { dateOfBirth: null },
        { dateOfBirth: { lte: ago(ctx, ctx.weaningDays) } },
    ],
});
const OPEN_STATES = ['OPEN', 'POSTPARTUM_WAITING'];
const freshStart = (ctx) => ago(ctx, ctx.freshDays);
exports.CATEGORY_RULES = {
    ALL: { matches: () => true, where: () => ({}) },
    MALE: {
        matches: (a) => a.gender === 'MALE' || a.gender === 'CASTRATED_MALE',
        where: () => ({ gender: { in: ['MALE', 'CASTRATED_MALE'] } }),
    },
    FEMALE: {
        matches: (a) => a.gender === 'FEMALE',
        where: () => ({ gender: 'FEMALE' }),
    },
    CALF: {
        matches: (a, c) => isCalf(a, c),
        where: (c) => youngerThan(c, c.weaningDays),
    },
    WEANED: {
        matches: (a, c) => {
            const age = ageDays(a, c.now);
            return age !== null && age >= c.weaningDays && age < c.breedingAgeDays;
        },
        where: (c) => ({
            AND: [
                { dateOfBirth: { lte: ago(c, c.weaningDays) } },
                { dateOfBirth: { gt: ago(c, c.breedingAgeDays) } },
            ],
        }),
    },
    COW: {
        matches: (a, c) => a.gender === 'FEMALE' && !isCalf(a, c) && a.totalCalvings > 0,
        where: (c) => ({
            AND: [
                { gender: 'FEMALE' },
                notCalfWhere(c),
                { reproductionProfile: { is: { totalCalvings: { gt: 0 } } } },
            ],
        }),
    },
    HEIFER: {
        matches: (a, c) => a.gender === 'FEMALE' && !isCalf(a, c) && a.totalCalvings === 0,
        where: (c) => ({
            AND: [
                { gender: 'FEMALE' },
                notCalfWhere(c),
                {
                    OR: [
                        { reproductionProfile: null },
                        { reproductionProfile: { is: { totalCalvings: 0 } } },
                    ],
                },
            ],
        }),
    },
    PREGNANT: {
        matches: (a) => a.reproductiveStatus === 'PREGNANT',
        where: () => ({
            reproductionProfile: { is: { reproductiveStatus: 'PREGNANT' } },
        }),
    },
    MILKING: {
        matches: (a) => a.productionStatus === 'MILKING',
        where: () => ({ productionStatus: 'MILKING' }),
    },
    DRY: {
        matches: (a) => a.productionStatus === 'DRY',
        where: () => ({ productionStatus: 'DRY' }),
    },
    FRESH: {
        matches: (a, c) => a.productionStatus === 'MILKING' &&
            a.activeLactationStart !== null &&
            a.activeLactationStart.getTime() >= freshStart(c).getTime(),
        where: (c) => ({
            productionStatus: 'MILKING',
            lactations: {
                some: { status: 'ACTIVE', startDate: { gte: freshStart(c) } },
            },
        }),
    },
    OPEN: {
        matches: (a) => a.reproductiveStatus !== null &&
            OPEN_STATES.includes(a.reproductiveStatus),
        where: () => ({
            reproductionProfile: {
                is: { reproductiveStatus: { in: ['OPEN', 'POSTPARTUM_WAITING'] } },
            },
        }),
    },
    FATTENING: {
        matches: (a) => a.inFattening,
        where: (c) => ({ id: { in: c.fatteningCattleIds ?? [] } }),
    },
};
function categoriesOf(a, ctx) {
    return exports.CATTLE_CATEGORIES.filter((k) => exports.CATEGORY_RULES[k].matches(a, ctx));
}
//# sourceMappingURL=categories.js.map