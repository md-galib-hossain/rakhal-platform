import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { MedicineService } from '../src/modules/inventory/application/services/medicine.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Notification emitter wiring (RAKHAL-098 follow-up). Proves the real event
 * triggers route through `NotificationService.notifyUsers` end-to-end: reporting
 * sickness raises an `animal_sickness_reported` alert in the Owner's bell feed.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Notification emitters (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let prisma: PrismaService;
  let ownerUserId: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
    prisma = ctx.app.get(PrismaService);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = user.id;
    await prisma.notification.deleteMany({ where: { userId: ownerUserId } });
  }, 30_000);

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { userId: ownerUserId } });
    await ctx.app.close();
  });

  it('report-sickness raises an animal_sickness_reported notification for the owner', async () => {
    // Pick a cow with no open case — the module 409s on a duplicate active case,
    // and the e2e DB carries state across specs/runs.
    const openCases = await prisma.healthCase.findMany({
      where: { farmId: owner.farmId, NOT: { status: 'RECOVERED' } },
      select: { cattleId: true },
    });
    const busy = new Set(openCases.map((c) => c.cattleId));
    const candidates = await prisma.cattle.findMany({
      where: { farmId: owner.farmId, herdStatus: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });
    const cattleId = candidates.find((c) => !busy.has(c.id))?.id;
    if (!cattleId)
      throw new Error('No cattle without an open case for the test');

    // Worker reports sickness (has `healthcare.report-sickness`).
    await request(server())
      .post(api('/health/cases'))
      .set(...auth(worker))
      .send({
        cattleId,
        diagnosis: 'Mastitis',
        diagnosisType: 'DISEASE',
        priority: 'HIGH',
        symptoms: ['swelling'],
      })
      .expect(201);

    // The Owner now has the in-app alert (the emitter routed through the engine).
    const feed = await request(server())
      .get(api('/notifications'))
      .set(...auth(owner))
      .expect(200);
    const alert = (
      feed.body.data.notifications as Array<{
        type: string;
        title: string;
        link: string;
      }>
    )
      // RAKHAL-107: the demo owner defaults to Bangla, so notification copy is
      // rendered in Bangla (`notification.animal_sickness_reported.title`).
      .find((n) => n.title === 'পশুর অসুস্থতার তথ্য পাওয়া গেছে');
    expect(alert).toBeDefined();
    expect(alert?.type).toBe('health_safety');
    expect(alert?.link).toContain('/healthcare/cases/');
    expect(feed.body.data.unread_count).toBeGreaterThanOrEqual(1);
  });

  it('crossing a medicine low-stock threshold raises low_medicine_stock', async () => {
    const medicineService = ctx.app.get(MedicineService);
    const now = new Date();
    const med = await prisma.medicine.create({
      data: {
        farmId: owner.farmId,
        name: `E2E LowStock Med ${Date.now()}`,
        type: 'LIQUID',
        category: 'ANTIBIOTIC',
        unitId: 'unit_bottle',
        currentStock: 6,
        lowStockThreshold: 5,
        costPerUnit: 10,
        purchaseDate: now,
        expiryDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
        createdBy: ownerUserId,
      },
    });

    // 6 → 4 crosses the threshold of 5 → exactly one downward-crossing alert.
    await medicineService.decrementForTreatment(owner.farmId, ownerUserId, {
      medicineId: med.id,
      quantity: 2,
    });

    const feed = await request(server())
      .get(api('/notifications'))
      .set(...auth(owner))
      .expect(200);
    const alert = (
      feed.body.data.notifications as Array<{ title: string; type: string }>
    )
      // RAKHAL-107: the demo owner defaults to Bangla (`notification.low_medicine_stock.title`).
      .find((n) => n.title === 'ওষুধের মজুদ কম');
    expect(alert).toBeDefined();
    expect(alert?.type).toBe('operational');

    await prisma.medicineStockMovement.deleteMany({
      where: { medicineId: med.id },
    });
    await prisma.medicine.delete({ where: { id: med.id } });
  });
});
