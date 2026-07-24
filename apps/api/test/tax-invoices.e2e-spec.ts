import request from 'supertest';
import { bearer, createTestApp, loginAs, TestContext } from './utils/e2e';
import type { AuthedUser } from './utils/e2e';
import { BillingPeriod } from '@prisma/client';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { BillingService } from '../src/modules/billing/application/services/billing.service';

/**
 * RAKHAL-237 — tax-ready invoices + receipt PDF (`customer-api`, PRD §36.2).
 * Proves: a paid invoice gets a **gapless sequential** number (never reused/
 * collided under concurrency, TAX-02), a downloadable **receipt PDF** (TAX-03),
 * and **VAT off by default** (TAX-01/04). Uses the ৳0 Free-plan path so invoices
 * reach PAID without a gateway.
 */
interface PublicInvoice {
  id: string;
  invoice_number: string | null;
  total: number;
  status: string;
  tax_rate: number;
  tax_amount: number;
}

const NUM_RE = /^INV-\d{6}$/;
const seq = (n: string) => Number(n.slice(4)); // "INV-000012" → 12

describe('Tax-ready invoices + receipt PDF (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let billing: BillingService;
  let owner: AuthedUser;
  let ownerUserId: string;
  let freePlanId: string;
  let proPlanId: string;
  let tempFarmId: string;
  let aPaidInvoiceId: string;
  const extraFarmIds: string[] = [];

  const checkoutFree = async (
    key: string,
    farmId: string = tempFarmId,
  ): Promise<PublicInvoice> => {
    const res = await billing.checkout(
      farmId,
      ownerUserId,
      { planId: freePlanId, billingPeriod: BillingPeriod.MONTHLY },
      key,
    );
    return res.invoice;
  };

  // Free-plan checkout is now gated to once-ever-per-farm — the concurrency
  // test below needs N independently-eligible farms, not N repeats on one.
  const makeFreeEligibleFarm = async (name: string): Promise<string> => {
    const farm = await prisma.farm.create({
      data: {
        name,
        slug: `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ownerId: ownerUserId,
        phone: '01700000002',
        address: '2 Tax Test Road, Dhaka',
      },
      select: { id: true },
    });
    extraFarmIds.push(farm.id);
    return farm.id;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    billing = ctx.app.get(BillingService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');

    const user = await prisma.user.findUnique({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    if (!user) throw new Error('demo owner missing — run `pnpm seed`');
    ownerUserId = user.id;

    const plans = await prisma.subscriptionPlan.findMany({
      where: { name: { in: ['Free', 'Pro'] } },
      select: { id: true, name: true },
    });
    const free = plans.find((p) => p.name === 'Free');
    const pro = plans.find((p) => p.name === 'Pro');
    if (!free || !pro) throw new Error('plans missing — run `pnpm seed`');
    freePlanId = free.id;
    proPlanId = pro.id;

    const farm = await prisma.farm.create({
      data: {
        name: 'E2E Tax Farm',
        slug: `e2e-tax-${Date.now()}`,
        ownerId: ownerUserId,
        // Free-plan checkout is gated on a complete profile — this suite is
        // about invoice numbering/receipts, not the profile gate itself.
        phone: '01700000001',
        address: '1 Tax Test Road, Dhaka',
      },
      select: { id: true },
    });
    tempFarmId = farm.id;
  }, 30_000);

  afterAll(async () => {
    for (const farmId of [tempFarmId, ...extraFarmIds].filter(Boolean)) {
      await prisma.payment.deleteMany({ where: { farmId } });
      await prisma.invoice.deleteMany({ where: { farmId } });
      await prisma.farmSubscription.deleteMany({ where: { farmId } });
      await prisma.farm.delete({ where: { id: farmId } }).catch(() => undefined);
    }
    await ctx.app.close();
  });

  it('a paid invoice gets a sequential number; VAT is off by default (TAX-01/02/04)', async () => {
    const inv = await checkoutFree(`e2e-tax-first-${Date.now()}`);
    expect(inv.status).toBe('PAID');
    expect(inv.total).toBe(0);
    expect(inv.invoice_number).toMatch(NUM_RE);
    expect(inv.tax_rate).toBe(0);
    expect(inv.tax_amount).toBe(0);
    aPaidInvoiceId = inv.id;
  });

  it('gapless + collision-free under concurrent checkout (TAX-02)', async () => {
    const N = 6;
    // Free-plan checkout is once-ever-per-farm — one farm per concurrent
    // checkout, proving the invoice-counter is what stays gapless/collision-
    // free across farms, not repeated activation of a single farm.
    const farmIds = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        makeFreeEligibleFarm(`E2E Tax Conc ${i}`),
      ),
    );
    const results = await Promise.all(
      farmIds.map((farmId, i) =>
        checkoutFree(`e2e-tax-conc-${Date.now()}-${i}`, farmId),
      ),
    );
    const numbers = results.map((r) => r.invoice_number);
    numbers.forEach((n) => expect(n).toMatch(NUM_RE));

    // No two invoices share a number (never reused/collided).
    const unique = new Set(numbers);
    expect(unique.size).toBe(N);

    // Gapless: the N sequence values form a contiguous run (max − min === N − 1).
    const values = numbers.map((n) => seq(n as string)).sort((a, b) => a - b);
    expect(values[N - 1] - values[0]).toBe(N - 1);
  });

  it('serves a downloadable receipt PDF for a paid invoice (TAX-03)', async () => {
    const receipt = await billing.getReceipt(tempFarmId, aPaidInvoiceId);
    expect(receipt.invoiceNumber).toMatch(NUM_RE);
    expect(receipt.fileName).toContain(receipt.invoiceNumber);
    // A real PDF starts with the "%PDF" magic bytes.
    expect(receipt.buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
    expect(receipt.buffer.length).toBeGreaterThan(500);
  });

  it('no receipt for an unpaid or unknown invoice (404)', async () => {
    // Unknown id on the demo owner's own farm → 404 through the HTTP endpoint.
    await request(ctx.app.getHttpServer())
      .get(`${ctx.prefix}/billing/invoices/does-not-exist/receipt`)
      .set(...bearer(owner))
      .expect(404);

    // A PENDING (unpaid) invoice has no receipt yet.
    const pending = await billing.checkout(
      tempFarmId,
      ownerUserId,
      { planId: proPlanId, billingPeriod: BillingPeriod.MONTHLY },
      `e2e-tax-pending-${Date.now()}`,
    );
    expect(pending.invoice.status).toBe('PENDING');
    await expect(
      billing.getReceipt(tempFarmId, pending.invoice.id),
    ).rejects.toThrow();
  });
});
