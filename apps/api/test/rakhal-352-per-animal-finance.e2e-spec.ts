import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { SellAnimalUseCase } from '../src/modules/sales/application/use-cases/sell-animal/sell-animal.use-case';
import {
  AuthedUser,
  bearer,
  createTestApp,
  loginAs,
  TestContext,
} from './utils/e2e';

/**
 * RAKHAL-352 — per-animal finance from `Sale` + ledger. Proves the ONE
 * shared aggregation (`cattle-finance-aggregation.ts`) that replaced three
 * previously-disagreeing bucketers:
 *   - `GET /cattle/:id/finance` (`CattleDetailService.cattleFinance()`)
 *   - `LactationEconomicsService.getEconomics()` (`GET
 *     /reproduction/lactations/:id/economics`)
 *   - `CattleService.tabFinance()` — deleted outright, it was dead code no
 *     controller route ever called.
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Cattle/Reproduction — per-animal finance agreement (e2e, RAKHAL-352)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let sellAnimal: SellAnimalUseCase;
  let owner: AuthedUser;
  let ownerUserId: string;

  const server = () => ctx.app.getHttpServer();
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const tag = () =>
    `E2E-352-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    sellAnimal = ctx.app.get(SellAnimalUseCase);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    const ownerUser = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = ownerUser.id;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  async function createCattle(): Promise<string> {
    const res = await request(server())
      .post(api('/cattle'))
      .set(...bearer(owner))
      .send({ tagNumber: tag(), gender: 'FEMALE' })
      .expect(201);
    return res.body.data.id as string;
  }

  it('a real V2 AnimalSaleLine sale shows up as animal-sale income on GET /cattle/:id/finance — real FK join, no string match', async () => {
    const cattleId = await createCattle();

    const result = await sellAnimal.execute(
      owner.farmId,
      ownerUserId,
      cattleId,
      {
        salePrice: 42000,
        buyerName: 'RAKHAL-352 E2E buyer',
        saleDate: new Date().toISOString(),
      },
    );
    expect(result.saleId).toBeTruthy();

    const finance = await request(server())
      .get(api(`/cattle/${cattleId}/finance`))
      .set(...bearer(owner))
      .expect(200);

    expect(
      finance.body.data.income_breakdown.calf_sales,
    ).toBeGreaterThanOrEqual(42000);
    expect(finance.body.data.total_income).toBeGreaterThanOrEqual(42000);
  });

  it('breeding cost (RAKHAL-330, migrated to V2 Expense.cattleId by RAKHAL-354) lands in the breeding bucket via the shared aggregation', async () => {
    const cattleId = await createCattle();
    const batch = await prisma.semenBatch.create({
      data: {
        farmId: owner.farmId,
        name: `E2E-352-BATCH-${Date.now()}`,
        strawQuantity: 10,
        costPerUnit: 500,
        createdBy: ownerUserId,
      },
    });

    const created = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...bearer(owner))
      .send({
        cattleId,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'AI',
        semenSource: 'FARM_INVENTORY',
        semenBatchId: batch.id,
        paymentMethod: 'CASH',
      })
      .expect(201);
    expect(created.body.data.financeTransactionId).toBeTruthy();

    const finance = await request(server())
      .get(api(`/cattle/${cattleId}/finance`))
      .set(...bearer(owner))
      .expect(200);

    expect(finance.body.data.expense_breakdown.breeding).toBeGreaterThanOrEqual(
      500,
    );
  });

  it('GET /cattle/:id/finance and GET /reproduction/lactations/:id/economics agree exactly on breeding for the same cow/period (core AC — these used to disagree)', async () => {
    const cattleId = await createCattle();
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );

    const lactation = await prisma.lactation.create({
      data: {
        cattleId,
        lactationNumber: 1,
        startDate: monthStart,
        status: 'ACTIVE',
      },
    });

    // RAKHAL-354: a breeding expense now lands on V2 `Expense` with a real
    // `cattleId` FK + `category: BREEDING` (ledger account `5300`) — the
    // shape `ReproductionService`'s migrated breeding-cost posting produces
    // via `ExpenseService.recordExpense`. Seeded directly here (bypassing
    // the HTTP route, which requires a real semen batch/service cost setup
    // already covered by the previous test) purely to prove the shared
    // aggregation reads it.
    const account = await prisma.financialAccount.findFirstOrThrow({
      where: { farmId: owner.farmId, isActive: true },
      select: { id: true },
    });
    await request(server())
      .post(api('/purchasing/expenses'))
      .set(...bearer(owner))
      .send({
        category: 'BREEDING',
        description: 'E2E-352 breeding expense',
        amount: 180,
        expenseDate: now.toISOString(),
        financialAccountId: account.id,
      })
      .expect(201)
      .then(async (res) => {
        await prisma.expense.update({
          where: { id: res.body.data.id },
          data: { cattleId },
        });
      });

    // Health/feed have no V2 per-animal expense source yet (documented gap,
    // `cattle-finance-aggregation.ts`'s own doc comment + `docs/TECH_DEBT.md`)
    // — both surfaces structurally read 0 for `health` now, which is itself
    // proof they still agree (never silently drift again).

    const period = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, '0')}`;
    const finance = await request(server())
      .get(api(`/cattle/${cattleId}/finance?period=${period}`))
      .set(...bearer(owner))
      .expect(200);

    const economics = await request(server())
      .get(api(`/reproduction/lactations/${lactation.id}/economics`))
      .set(...bearer(owner))
      .expect(200);

    expect(finance.body.data.expense_breakdown.breeding).toBe(180);
    expect(finance.body.data.expense_breakdown.health).toBe(0);
    // The core AC: both surfaces now read the identical shared aggregation,
    // so they can never disagree again.
    expect(economics.body.data.financial.medicineCost).toBe(
      finance.body.data.expense_breakdown.health,
    );
    expect(economics.body.data.financial.breedingCost).toBe(
      finance.body.data.expense_breakdown.breeding,
    );
  });
});
