/**
 * Shared money primitives — Decimal-safe arithmetic for finance-v2 code
 * (RAKHAL-331, `FINANCE_V2_DESIGN.md` §1.4/§6).
 *
 *   import { Money, toMoney, add, subtract, multiply, round2, toStorage } from 'src/common/money';
 *
 * Money is always `Prisma.Decimal`, never a JS `number`. See `money.util.ts` for the
 * full API and `money.util.spec.ts` for the rounding/negative/`0.1+0.2` proofs.
 */
export * from './money.util';
