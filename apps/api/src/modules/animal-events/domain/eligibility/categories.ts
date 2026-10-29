/**
 * RAKHAL-480: the 13 animal categories (chips). ONE table drives both
 * `matches(facts, ctx)` (in-memory, used for per-animal eligibility) and
 * `where(ctx)` (Prisma, used for `GET /cattle?category=`), so the two cannot
 * drift. Owner decisions (hub §8): open = not pregnant and not bred (includes
 * the post-calving wait); weaned ends at the farm's breeding-age setting;
 * fresh reuses `lactationFreshDays`.
 */
import { Prisma } from '@prisma/client';

export const CATTLE_CATEGORIES = [
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
] as const;
export type CattleCategory = (typeof CATTLE_CATEGORIES)[number];

export interface AnimalFacts {
  gender: 'MALE' | 'FEMALE' | 'CASTRATED_MALE';
  dateOfBirth: Date | null;
  /** `reproductionProfile.totalCalvings`, 0 when there is no profile row. */
  totalCalvings: number;
  productionStatus: 'MILKING' | 'DRY' | null;
  /** `reproductionProfile.reproductiveStatus`; null = no profile row. */
  reproductiveStatus: string | null;
  /** Start date of the ACTIVE lactation, if any. */
  activeLactationStart: Date | null;
  /** Latest ENTER_FATTENING not followed by LEAVE_FATTENING. */
  inFattening: boolean;
}

export interface CategoryContext {
  now: Date;
  weaningDays: number;
  breedingAgeDays: number;
  freshDays: number;
  /** Pre-loaded ids of animals in fattening (only needed for FATTENING `where`). */
  fatteningCattleIds?: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ageDays = (a: AnimalFacts, now: Date) =>
  a.dateOfBirth
    ? Math.floor((now.getTime() - a.dateOfBirth.getTime()) / DAY_MS)
    : null;
const ago = (ctx: CategoryContext, days: number) =>
  new Date(ctx.now.getTime() - days * DAY_MS);
/** age < days  <=>  dateOfBirth > now - days. */
const youngerThan = (ctx: CategoryContext, days: number) => ({
  dateOfBirth: { gt: ago(ctx, days) },
});
const isCalf = (a: AnimalFacts, c: CategoryContext) => {
  const age = ageDays(a, c.now);
  return age !== null && age < c.weaningDays;
};
const notCalfWhere = (ctx: CategoryContext): Prisma.CattleWhereInput => ({
  OR: [
    { dateOfBirth: null },
    { dateOfBirth: { lte: ago(ctx, ctx.weaningDays) } },
  ],
});
const OPEN_STATES = ['OPEN', 'POSTPARTUM_WAITING'];
const freshStart = (ctx: CategoryContext) => ago(ctx, ctx.freshDays);

export interface CategoryRule {
  matches(a: AnimalFacts, ctx: CategoryContext): boolean;
  where(ctx: CategoryContext): Prisma.CattleWhereInput;
}

export const CATEGORY_RULES: Record<CattleCategory, CategoryRule> = {
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
    matches: (a, c) =>
      a.gender === 'FEMALE' && !isCalf(a, c) && a.totalCalvings > 0,
    where: (c) => ({
      AND: [
        { gender: 'FEMALE' },
        notCalfWhere(c),
        { reproductionProfile: { is: { totalCalvings: { gt: 0 } } } },
      ],
    }),
  },
  HEIFER: {
    matches: (a, c) =>
      a.gender === 'FEMALE' && !isCalf(a, c) && a.totalCalvings === 0,
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
    matches: (a, c) =>
      a.productionStatus === 'MILKING' &&
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
    matches: (a) =>
      a.reproductiveStatus !== null &&
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

/** Categories (chips) an animal belongs to. */
export function categoriesOf(
  a: AnimalFacts,
  ctx: CategoryContext,
): CattleCategory[] {
  return CATTLE_CATEGORIES.filter((k) => CATEGORY_RULES[k].matches(a, ctx));
}
