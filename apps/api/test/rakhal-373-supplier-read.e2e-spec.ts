import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import {
  AuthedUser,
  bearer,
  createTestApp,
  createThrowawayOwner,
  deleteThrowawayOwner,
  TestContext,
} from './utils/e2e';

/**
 * RAKHAL-373 (MILESTONE 22, `BUSINESS_IA_PRD.md` §5.12) — Supplier read
 * model. Proves the ticket's own AC against the real DB + HTTP surface:
 *
 * - `GET /purchasing/suppliers` → `name, phone, totalPurchases, payable,
 *   lastPurchaseAt, status` per supplier;
 * - `GET /purchasing/suppliers/summary` → total/active/totalPurchases/
 *   totalPayable across the farm;
 * - `/settings/suppliers` CRUD is untouched — the fixture supplier is
 *   created directly via Prisma (mirroring `settings.createSupplier`'s own
 *   write shape) and this ticket only reads it back.
 *
 * Runs on a fresh, empty farm (`FarmService.create()`) — same precedent
 * every other RAKHAL-36x/37x business-ia spec in this suite documents.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Purchasing — Supplier read model (e2e, RAKHAL-373)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let ownerUserId: string;
  let farmId: string;
  let supplierId: string;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const unique = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);

    const throwaway = await createThrowawayOwner(
      ctx,
      prisma,
      unique('E2E-373-SupplierFarm'),
    );
    ownerUserId = throwaway.userId;
    farmId = throwaway.farmId;
    owner = throwaway.owner;

    const supplier = await prisma.supplier.create({
      data: { farmId, name: 'E2E-373 Feed Supplier', phone: '01700000373' },
    });
    supplierId = supplier.id;
  }, 30_000);

  afterAll(async () => {
    await prisma.purchase
      .deleteMany({ where: { farmId } })
      .catch(() => undefined);
    await prisma.supplier
      .deleteMany({ where: { farmId } })
      .catch(() => undefined);
    await deleteThrowawayOwner(prisma, { userId: ownerUserId, farmId });
    await ctx.app.close();
  });

  it('lists a supplier with zero purchases/payable before any document exists', async () => {
    const res = await request(server())
      .get(api('/purchasing/suppliers'))
      .set(...bearer(owner))
      .expect(200);

    const rows = res.body.data as {
      id: string;
      name: string;
      phone: string | null;
      totalPurchases: string;
      payable: string;
      lastPurchaseAt: string | null;
      status: string;
    }[];
    const row = rows.find((r) => r.id === supplierId);
    expect(row).toBeDefined();
    expect(row?.name).toBe('E2E-373 Feed Supplier');
    expect(row?.phone).toBe('01700000373');
    expect(row?.totalPurchases).toBe('0');
    expect(row?.payable).toBe('0');
    expect(row?.lastPurchaseAt).toBeNull();
    expect(row?.status).toBe('ACTIVE');
  });

  it('reflects a real Purchase and a real unpaid Expense on the same supplier', async () => {
    // Direct Prisma fixture, not the HTTP route: `POST /purchasing/purchases`
    // requires a real inventory-item line (medicine/feedItem/equipment id),
    // which is out of scope for a read-model test — same "fixture via
    // Prisma, not the full write path" precedent RAKHAL-369/371's specs use
    // for Sale/Receivable.
    await prisma.purchase.create({
      data: {
        farmId,
        supplierId,
        purchaseNumber: unique('E2E-373-PUR'),
        purchaseDate: new Date(),
        totalAmount: 800,
        createdById: ownerUserId,
      },
    });

    await request(server())
      .post(api('/purchasing/expenses'))
      .set(...bearer(owner))
      .send({
        category: 'OTHER',
        description: 'E2E-373 unpaid supplier expense',
        amount: 200,
        expenseDate: new Date().toISOString(),
        supplierId,
      })
      .expect(201);

    const res = await request(server())
      .get(api('/purchasing/suppliers'))
      .set(...bearer(owner))
      .expect(200);
    const row = (
      res.body.data as {
        id: string;
        totalPurchases: string;
        payable: string;
        lastPurchaseAt: string | null;
      }[]
    ).find((r) => r.id === supplierId);
    expect(row?.totalPurchases).toBe('800');
    expect(row?.payable).toBe('200');
    expect(row?.lastPurchaseAt).not.toBeNull();

    const summary = await request(server())
      .get(api('/purchasing/suppliers/summary'))
      .set(...bearer(owner))
      .expect(200);
    const data = summary.body.data as {
      totalCount: number;
      activeCount: number;
      totalPurchases: string;
      totalPayable: string;
    };
    expect(data.totalCount).toBe(1);
    expect(data.activeCount).toBe(1);
    expect(data.totalPurchases).toBe('800');
    expect(data.totalPayable).toBe('200');
  });
});
