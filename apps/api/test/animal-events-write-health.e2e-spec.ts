/* eslint-disable @typescript-eslint/no-unsafe-argument */
import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { EventHandlerRegistry } from '../src/modules/animal-events/application/event-handler';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-481 follow-up (RD-130): health event types, HISTORICAL side-effect
 * skipping for every type, and header + detail in one transaction.
 * Requires dev stack + `pnpm seed`.
 */
describe('POST /cattle/:id/events — health, history, transaction (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let userId: string;
  let medicineId: string;
  const run = Date.now();
  const api = (p: string) => `${ctx.prefix}${p}`;
  const day = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

  const post = (
    u: AuthedUser,
    cattleId: string,
    body: object,
    headers: Record<string, string> = {},
  ) => {
    const r = request(ctx.app.getHttpServer())
      .post(api(`/cattle/${cattleId}/events`))
      .set('Authorization', `Bearer ${u.token}`);
    for (const [k, v] of Object.entries(headers)) r.set(k, v);
    return r.send(body);
  };
  const cow = (key: string) =>
    prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-481H-${key}-${run}`,
        gender: 'FEMALE',
        dateOfBirth: new Date(Date.now() - 1500 * 86400000),
        createdBy: userId,
      },
    });
  const codes = (res: request.Response) =>
    (res.body.data.findings as { code: string }[]).map((f) => f.code);
  const batchStock = async () =>
    (
      await prisma.medicineBatch.aggregate({
        where: { medicineId },
        _sum: { currentStock: true },
      })
    )._sum.currentStock ?? 0;
  const sideEffects = async (cattleId: string) => ({
    aqr: (await prisma.cattle.findUniqueOrThrow({ where: { id: cattleId } }))
      .aqrScore,
    expenses: await prisma.expense.count({ where: { cattleId } }),
    tasks: await prisma.task.count({ where: { relatedCattleId: cattleId } }),
    stock: await batchStock(),
  });

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
    userId = (
      await prisma.user.findFirstOrThrow({
        where: { email: 'owner@demo.rakhal.test' },
        select: { id: true },
      })
    ).id;
    const unit = await prisma.unit.findFirstOrThrow({
      where: { symbol: 'mL', OR: [{ farmId: owner.farmId }, { farmId: null }] },
    });
    const med = await prisma.medicine.create({
      data: {
        farmId: owner.farmId,
        name: `E2E-481H-vaccine-${run}`,
        type: 'LIQUID',
        category: 'VACCINE',
        unitId: unit.id,
        costPerUnit: 10,
        purchaseDate: new Date(),
        expiryDate: new Date(Date.now() + 365 * 86400000),
        currentStock: 20,
        createdBy: userId,
      },
    });
    medicineId = med.id;
    await prisma.medicineBatch.create({
      data: {
        medicineId,
        farmId: owner.farmId,
        batchCode: `B-${run}`,
        currentStock: 20,
        costPerUnit: 10,
        purchaseDate: new Date(),
        expiryDate: new Date(Date.now() + 365 * 86400000),
        createdBy: userId,
      },
    });
  }, 60_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('vaccinating a cow with no case: 201, a TreatmentLog, exactly one header', async () => {
    const c = await cow('VAC');
    const before = await batchStock();
    const res = await post(owner, c.id, {
      type: 'VACCINATION',
      eventAt: day(1),
      payload: {
        medicineId,
        doseAmount: 2,
        doseUnit: 'mL',
        route: 'IM',
        nextDoseDays: 28,
      },
    }).expect(201);
    expect(res.body.data.event.type).toBe('VACCINATION');
    expect(res.body.data.event.data.nextDoseDays).toBe(28);
    const logs = await prisma.treatmentLog.findMany({
      where: { cattleId: c.id },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].animalEventId).toBe(res.body.data.event.id);
    expect(await prisma.animalEvent.count({ where: { cattleId: c.id } })).toBe(
      1,
    );
    expect(await batchStock()).toBe(before - 2);
  });

  it('insufficient stock blocks and leaves nothing behind', async () => {
    const c = await cow('STOCK');
    const before = await batchStock();
    const res = await post(owner, c.id, {
      type: 'VACCINATION',
      eventAt: day(1),
      payload: { medicineId, doseAmount: 9999, doseUnit: 'mL', route: 'IM' },
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await prisma.treatmentLog.count({ where: { cattleId: c.id } })).toBe(
      0,
    );
    expect(await prisma.animalEvent.count({ where: { cattleId: c.id } })).toBe(
      0,
    );
    expect(await batchStock()).toBe(before);
  });

  it('Idempotency-Key replay saves one TreatmentLog', async () => {
    const c = await cow('IDEM');
    const body = {
      type: 'DEWORMING',
      eventAt: day(1),
      payload: {
        medicineName: 'ivermectin',
        outsideInventory: true,
        doseAmount: 5,
        doseUnit: 'mL',
        route: 'SC',
      },
    };
    const h = { 'Idempotency-Key': `e2e-481h-${run}` };
    const a = await post(owner, c.id, body, h).expect(201);
    const b = await post(owner, c.id, body, h).expect(201);
    expect(b.body.data.event.id).toBe(a.body.data.event.id);
    expect(await prisma.treatmentLog.count({ where: { cattleId: c.id } })).toBe(
      1,
    );
    expect(await prisma.animalEvent.count({ where: { cattleId: c.id } })).toBe(
      1,
    );
  });

  it('ILLNESS twice: the second saves with OPEN_CASE_EXISTS (no 409)', async () => {
    const c = await cow('ILL');
    const body = {
      type: 'ILLNESS',
      eventAt: day(1),
      payload: { condition: 'MASTITIS', severity: 'HIGH' },
    };
    const a = await post(owner, c.id, body).expect(201);
    expect(codes(a)).not.toContain('OPEN_CASE_EXISTS');
    const b = await post(owner, c.id, body).expect(201);
    expect(codes(b)).toContain('OPEN_CASE_EXISTS');
    expect(await prisma.healthCase.count({ where: { cattleId: c.id } })).toBe(
      2,
    );
  });

  it('TREATMENT with no case opens one (TREATMENT_NEW_CASE); the next attaches to it', async () => {
    const c = await cow('TRT');
    const body = {
      type: 'TREATMENT',
      eventAt: day(1),
      payload: {
        medicineName: 'oxytetracycline',
        outsideInventory: true,
        doseAmount: 10,
        doseUnit: 'mL',
        route: 'IM',
      },
    };
    const a = await post(owner, c.id, body).expect(201);
    expect(codes(a)).toContain('TREATMENT_NEW_CASE');
    const b = await post(owner, c.id, body).expect(201);
    expect(codes(b)).not.toContain('TREATMENT_NEW_CASE');
    expect(await prisma.healthCase.count({ where: { cattleId: c.id } })).toBe(
      1,
    );
    expect(await prisma.treatmentLog.count({ where: { cattleId: c.id } })).toBe(
      2,
    );
  });

  it('worker permissions match the existing health permissions', async () => {
    const c = await cow('WRK');
    await post(worker, c.id, {
      type: 'ILLNESS',
      eventAt: day(0.5),
      payload: { condition: 'LAMENESS' },
    }).expect(201);
    await post(worker, c.id, {
      type: 'DEWORMING',
      eventAt: day(0.5),
      payload: {
        medicineName: 'x',
        outsideInventory: true,
        doseAmount: 1,
        doseUnit: 'mL',
        route: 'SC',
      },
    }).expect(201);
  });

  describe('HISTORICAL entries skip AQR, expense, stock and tasks', () => {
    it('history AI', async () => {
      const c = await cow('HAI');
      const before = await sideEffects(c.id);
      const res = await post(owner, c.id, {
        type: 'BREEDING',
        eventAt: day(40),
        payload: {
          breedingMethod: 'AI',
          serviceCost: 450,
          sireNameOrCode: 'S-1',
        },
      }).expect(201);
      expect(res.body.data.event.provenance).toBe('HISTORICAL');
      expect(await sideEffects(c.id)).toEqual(before);
    });

    it('history vaccination (with an inventory batch named)', async () => {
      const c = await cow('HVAC');
      const before = await sideEffects(c.id);
      const res = await post(owner, c.id, {
        type: 'VACCINATION',
        eventAt: day(40),
        payload: {
          medicineId,
          doseAmount: 2,
          doseUnit: 'mL',
          route: 'IM',
          vetCost: 300,
        },
      }).expect(201);
      expect(res.body.data.event.provenance).toBe('HISTORICAL');
      expect(await sideEffects(c.id)).toEqual(before);
      expect(
        await prisma.treatmentLog.count({ where: { cattleId: c.id } }),
      ).toBe(1);
    });

    it('history calving', async () => {
      const c = await cow('HCALV');
      const before = await sideEffects(c.id);
      const res = await post(owner, c.id, {
        type: 'CALVING',
        eventAt: day(60),
        payload: {
          calvingEase: 'NORMAL',
          calves: [
            {
              gender: 'FEMALE',
              status: 'ALIVE',
              tagNumber: `E2E-481H-CALF-${run}`,
            },
          ],
        },
      });
      expect(res.status).toBe(201);
      expect(res.body.data.event.provenance).toBe('HISTORICAL');
      expect(await sideEffects(c.id)).toEqual(before);
    });
  });

  it('a handler failing after the detail write leaves no header and no detail row', async () => {
    const c = await cow('ROLLBACK');
    const registry = ctx.app.get(EventHandlerRegistry);
    const handler = registry.get('HEAT')!;
    const original = handler.handle.bind(handler);
    const spy = jest
      .spyOn(handler, 'handle')
      .mockImplementationOnce(async (type, input) => {
        await original(type, input);
        throw new Error('boom after detail write');
      });
    const res = await post(owner, c.id, {
      type: 'HEAT',
      eventAt: day(1),
      payload: { detectionMethod: 'VISUAL' },
    });
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect(await prisma.heatEvent.count({ where: { cattleId: c.id } })).toBe(0);
    expect(await prisma.animalEvent.count({ where: { cattleId: c.id } })).toBe(
      0,
    );
  });
});
