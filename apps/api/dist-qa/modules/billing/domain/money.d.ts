import { Prisma } from '@prisma/client';
export declare function round2(value: Prisma.Decimal): Prisma.Decimal;
export declare function clampNonNegative(value: Prisma.Decimal): Prisma.Decimal;
export declare function computeInvoiceTotal(subtotal: Prisma.Decimal, discountTotal: Prisma.Decimal): Prisma.Decimal;
export declare function computeTax(taxableBase: Prisma.Decimal, ratePct: Prisma.Decimal): Prisma.Decimal;
export declare function computeGrandTotal(subtotal: Prisma.Decimal, discountTotal: Prisma.Decimal, taxAmount: Prisma.Decimal, creditApplied: Prisma.Decimal): Prisma.Decimal;
