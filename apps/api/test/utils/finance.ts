import request from 'supertest';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { AuthedUser, TestContext } from './e2e';

/** Resolve the farm's single `FinancialAccount` id for specs that post a real cost
 * (`GET /finance/accounts/farm-account`, which auto-creates "Main Wallet" if absent). */
export async function seededCashAccountId(
  ctx: TestContext,
  user: AuthedUser,
): Promise<string> {
  // One account per farm: ask the server which one it is (auto-created on first use).
  const res = await request(ctx.app.getHttpServer())
    .get(`${ctx.prefix}/finance/accounts/farm-account`)
    .set('Authorization', `Bearer ${user.token}`)
    .expect(200);
  return (res.body.data as { id: string }).id;
}

/**
 * Create an *additional* `FinancialAccount` on a farm that already has one, through the real
 * `POST /finance/accounts` route. The route now 409s when the farm has a live account (one
 * account per farm), but farms that predate that rule still hold several and must keep working —
 * so specs that exercise multi-account behaviour (balance breakdown by type, payments into a
 * bank/MFS account, archive, primary switching…) build that "legacy" state with this helper.
 *
 * It archives the farm's live accounts for the duration of the POST (so the rule lets it through)
 * and restores them afterwards; the new account comes back non-primary when an older live account
 * existed, as it would have for a legacy farm. Safe because the e2e suite runs in-band.
 */
export async function createExtraAccount(
  ctx: TestContext,
  prisma: PrismaService,
  user: AuthedUser,
  body: Record<string, unknown>,
): Promise<{ id: string; ledgerAccountId: string; [k: string]: unknown }> {
  const live = await prisma.financialAccount.findMany({
    where: { farmId: user.farmId, deletedAt: null },
    select: { id: true },
  });
  const liveIds = live.map((a) => a.id);
  const archivedAt = new Date();
  await prisma.financialAccount.updateMany({
    where: { id: { in: liveIds } },
    data: { deletedAt: archivedAt },
  });
  try {
    const res = await request(ctx.app.getHttpServer())
      .post(`${ctx.prefix}/finance/accounts`)
      .set('Authorization', `Bearer ${user.token}`)
      .send(body)
      .expect(201);
    const created = (
      res.body as { data: { id: string; ledgerAccountId: string } }
    ).data;
    if (liveIds.length) {
      await prisma.financialAccount.update({
        where: { id: created.id },
        data: { isPrimary: false },
      });
    }
    return liveIds.length ? { ...created, isPrimary: false } : created;
  } finally {
    await prisma.financialAccount.updateMany({
      where: { id: { in: liveIds }, deletedAt: archivedAt },
      data: { deletedAt: null },
    });
  }
}
