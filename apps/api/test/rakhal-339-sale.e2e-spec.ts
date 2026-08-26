import request from 'supertest';
import { SaleLineType, SaleStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import {
  AuthedUser,
  bearer,
  createTestApp,
  loginAs,
  TestContext,
} from './utils/e2e';

/**
 * RAKHAL-339 — `Sale` + `SaleLine` + typed detail tables (`FINANCE_V2_DESIGN.md`
 * §4.3, §5.1). Proves the ticket's own AC against the real DB + HTTP surface:
 *
 * - creating a sale with an ANIMAL line persists `SaleLine` + `AnimalSaleLine`
 *   with the real `cattleId` FK;
 * - creating a sale with an INVENTORY line persists `SaleLine` +
 *   `InventorySaleLine` with exactly the chosen item's FK column set, the
 *   other two left null;
 * - `saleNumber` is `SALE-NNNNNN`-shaped and unique per farm (a second sale
 *   never repeats a number — the real-concurrency proof lives in
 *   `sale-number.allocator.spec.ts`, this just proves the HTTP path wires
 *   into the same allocator and format);
 * - `subtotal`/`totalAmount` are computed server-side from `lines`, never
 *   trusted from the client;
 * - malformed line shapes (ANIMAL with no cattleId, INVENTORY with two FKs)
 *   are rejected with 400 before anything is persisted;
 * - RBAC (`sales.create`/`sales.read`: Owner + Manager, not Worker).
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Sales — Sale + SaleLine (e2e, RAKHAL-339)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let manager: AuthedUser;
  let worker: AuthedUser;
  let ownerUserId: string;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    manager = await loginAs(ctx, 'manager@demo.rakhal.test', 'ManagerPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
    const user = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = user.id;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  const uniqueTag = () =>
    `E2E-RAKHAL339-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  async function createCow() {
    return prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: uniqueTag(),
        gender: 'FEMALE',
        purpose: 'MILK',
        createdBy: ownerUserId,
      },
    });
  }

  async function createMedicine() {
    const now = new Date();
    return prisma.medicine.create({
      data: {
        farmId: owner.farmId,
        name: `E2E RAKHAL-339 Medicine ${Date.now()}`,
        type: 'INJECTABLE',
        category: 'ANTIBIOTIC',
        unitId: 'unit_ml',
        currentStock: 100,
        costPerUnit: 10,
        lowStockThreshold: 0,
        purchaseDate: now,
        expiryDate: new Date(now.getTime() + 90 * 86_400_000),
        createdBy: ownerUserId,
      },
    });
  }

  it('creates a DRAFT sale with an ANIMAL line, persisting the real cattleId FK', async () => {
    const cow = await createCow();

    const res = await request(server())
      .post(api('/sales'))
      .set(...bearer(owner))
      .send({
        saleDate: new Date().toISOString(),
        lines: [
          {
            type: SaleLineType.ANIMAL,
            description: 'Sold dry cow',
            quantity: 1,
            unitPrice: 45000,
            cattleId: cow.id,
          },
        ],
      });

    expect(res.status).toBe(201);
    const sale = res.body.data as {
      id: string;
      saleNumber: string;
      status: SaleStatus;
      subtotal: string;
      totalAmount: string;
      lines: Array<{
        id: string;
        type: SaleLineType;
        totalAmount: string;
        animalDetail: { cattleId: string } | null;
      }>;
    };

    // RAKHAL-368 (MILESTONE 22): prefix flipped SALE- -> INV- (the Sale IS
    // the invoice); same FarmCounter scope, so format-only, no data change.
    expect(sale.saleNumber).toMatch(/^INV-\d{6}$/);
    expect(sale.status).toBe(SaleStatus.DRAFT);
    expect(sale.subtotal).toBe('45000');
    expect(sale.totalAmount).toBe('45000');
    expect(sale.lines).toHaveLength(1);
    expect(sale.lines[0].type).toBe(SaleLineType.ANIMAL);
    expect(sale.lines[0].animalDetail?.cattleId).toBe(cow.id);

    const dbSaleLine = await prisma.saleLine.findFirstOrThrow({
      where: { saleId: sale.id },
      include: { animalDetail: true },
    });
    expect(dbSaleLine.animalDetail?.cattleId).toBe(cow.id);
  });

  it('creates a sale with an INVENTORY line, persisting exactly the medicineId FK', async () => {
    const medicine = await createMedicine();

    const res = await request(server())
      .post(api('/sales'))
      .set(...bearer(owner))
      .send({
        saleDate: new Date().toISOString(),
        lines: [
          {
            type: SaleLineType.INVENTORY,
            description: 'Sold surplus antibiotic',
            quantity: 5,
            unitPrice: 20,
            medicineId: medicine.id,
          },
        ],
      });

    expect(res.status).toBe(201);
    const sale = res.body.data as {
      id: string;
      totalAmount: string;
      lines: Array<{
        inventoryDetail: {
          medicineId: string | null;
          feedItemId: string | null;
          equipmentId: string | null;
        } | null;
      }>;
    };
    expect(sale.totalAmount).toBe('100');
    expect(sale.lines[0].inventoryDetail?.medicineId).toBe(medicine.id);
    expect(sale.lines[0].inventoryDetail?.feedItemId).toBeNull();
    expect(sale.lines[0].inventoryDetail?.equipmentId).toBeNull();
  });

  it('computes subtotal/totalAmount from lines server-side, applying discountAmount', async () => {
    const cow = await createCow();

    const res = await request(server())
      .post(api('/sales'))
      .set(...bearer(owner))
      .send({
        saleDate: new Date().toISOString(),
        discountAmount: 1000,
        lines: [
          {
            type: SaleLineType.ANIMAL,
            description: 'Sold heifer',
            quantity: 1,
            unitPrice: 30000,
            cattleId: cow.id,
          },
        ],
      });

    expect(res.status).toBe(201);
    const sale = res.body.data as {
      subtotal: string;
      discountAmount: string;
      totalAmount: string;
    };
    expect(sale.subtotal).toBe('30000');
    expect(sale.discountAmount).toBe('1000');
    expect(sale.totalAmount).toBe('29000');
  });

  it('allocates strictly unique SALE-NNNNNN numbers across sales', async () => {
    const cowA = await createCow();
    const cowB = await createCow();

    const makeSale = (cattleId: string) =>
      request(server())
        .post(api('/sales'))
        .set(...bearer(owner))
        .send({
          saleDate: new Date().toISOString(),
          lines: [
            {
              type: SaleLineType.ANIMAL,
              description: 'Sold cow',
              quantity: 1,
              unitPrice: 40000,
              cattleId,
            },
          ],
        });

    const [first, second] = await Promise.all([
      makeSale(cowA.id),
      makeSale(cowB.id),
    ]);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const firstNumber = (first.body.data as { saleNumber: string }).saleNumber;
    const secondNumber = (second.body.data as { saleNumber: string })
      .saleNumber;
    expect(firstNumber).not.toBe(secondNumber);
  });

  it('rejects an ANIMAL line with no cattleId', async () => {
    const res = await request(server())
      .post(api('/sales'))
      .set(...bearer(owner))
      .send({
        saleDate: new Date().toISOString(),
        lines: [
          {
            type: SaleLineType.ANIMAL,
            description: 'Missing cattleId',
            quantity: 1,
            unitPrice: 1000,
          },
        ],
      });
    expect(res.status).toBe(400);
  });

  it('rejects an INVENTORY line carrying two item FKs at once', async () => {
    const medicine = await createMedicine();

    const res = await request(server())
      .post(api('/sales'))
      .set(...bearer(owner))
      .send({
        saleDate: new Date().toISOString(),
        lines: [
          {
            type: SaleLineType.INVENTORY,
            description: 'Ambiguous item',
            quantity: 1,
            unitPrice: 1000,
            medicineId: medicine.id,
            equipmentId: medicine.id,
          },
        ],
      });
    expect(res.status).toBe(400);
  });

  it('rejects an ANIMAL line pointing at a cow from another farm', async () => {
    const otherFarm = await prisma.farm.findFirstOrThrow({
      where: { id: { not: owner.farmId } },
      select: { id: true, ownerId: true },
    });
    const foreignCow = await prisma.cattle.create({
      data: {
        farmId: otherFarm.id,
        tagNumber: uniqueTag(),
        gender: 'FEMALE',
        purpose: 'MILK',
        createdBy: otherFarm.ownerId,
      },
    });

    const res = await request(server())
      .post(api('/sales'))
      .set(...bearer(owner))
      .send({
        saleDate: new Date().toISOString(),
        lines: [
          {
            type: SaleLineType.ANIMAL,
            description: 'Cross-farm cow',
            quantity: 1,
            unitPrice: 1000,
            cattleId: foreignCow.id,
          },
        ],
      });
    expect(res.status).toBe(404);
  });

  it('GET /sales/:id round-trips the created sale', async () => {
    const cow = await createCow();
    const created = await request(server())
      .post(api('/sales'))
      .set(...bearer(owner))
      .send({
        saleDate: new Date().toISOString(),
        lines: [
          {
            type: SaleLineType.ANIMAL,
            description: 'Sold cow',
            quantity: 1,
            unitPrice: 22000,
            cattleId: cow.id,
          },
        ],
      });
    expect(created.status).toBe(201);
    const saleId = (created.body.data as { id: string }).id;

    const fetched = await request(server())
      .get(api(`/sales/${saleId}`))
      .set(...bearer(owner));
    expect(fetched.status).toBe(200);
    expect((fetched.body.data as { id: string }).id).toBe(saleId);
  });

  it('RBAC: Worker cannot create or read sales, Manager can', async () => {
    const cow = await createCow();

    const workerCreate = await request(server())
      .post(api('/sales'))
      .set(...bearer(worker))
      .send({
        saleDate: new Date().toISOString(),
        lines: [
          {
            type: SaleLineType.ANIMAL,
            description: 'Worker attempt',
            quantity: 1,
            unitPrice: 1000,
            cattleId: cow.id,
          },
        ],
      });
    expect(workerCreate.status).toBe(403);

    const workerRead = await request(server())
      .get(api('/sales'))
      .set(...bearer(worker));
    expect(workerRead.status).toBe(403);

    const managerCreate = await request(server())
      .post(api('/sales'))
      .set(...bearer(manager))
      .send({
        saleDate: new Date().toISOString(),
        lines: [
          {
            type: SaleLineType.ANIMAL,
            description: 'Manager sale',
            quantity: 1,
            unitPrice: 15000,
            cattleId: cow.id,
          },
        ],
      });
    expect(managerCreate.status).toBe(201);
  });
});
