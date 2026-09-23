import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { FeedLotResolver } from 'src/modules/feed/application/services/feed-lot-resolver.service';
import { NutritionProfileService } from 'src/modules/feed/application/services/nutrition-profile.service';
import { toNutritionValues } from 'src/modules/feed/domain/nutrition-profile';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-443 (MILESTONE 26) — `NutritionProfileService` + `FeedLotResolver`, exercised at service level
 * (the HTTP routes land in RAKHAL-444). Requires the dev stack up + `pnpm seed` + the RAKHAL-442 migration.
 */
describe('Nutrition profiles (e2e, service level)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let userId: string;
  let prisma: PrismaService;
  let profiles: NutritionProfileService;
  let resolver: FeedLotResolver;

  const startedAt = new Date();
  const created = { itemIds: [] as string[], ingredientIds: [] as string[] };
  const hayValues = () =>
    toNutritionValues({
      dmPct: 88,
      cpPct: 9,
      meMjPerKgDm: 8.5,
      ndfPct: 65,
      adfPct: 40,
    });

  async function makeItemWithBatch(name: string) {
    const profile = await profiles.create(owner.farmId, userId, {
      values: hayValues(),
    });
    const item = await prisma.feedItem.create({
      data: {
        farmId: owner.farmId,
        name: `${name} ${Date.now()}-${Math.random()}`,
        feedClass: 'FORAGE',
        unitId: 'unit_kg',
        costPerUnit: 5,
        purchaseDate: new Date(),
        createdBy: userId,
        defaultNutritionProfileId: profile.id,
      },
    });
    created.itemIds.push(item.id);
    const batch = await prisma.feedItemBatch.create({
      data: {
        feedItemId: item.id,
        farmId: owner.farmId,
        currentStock: 10,
        costPerUnit: 5,
        purchaseDate: new Date(),
        nutritionProfileId: profile.id,
        createdBy: userId,
      },
    });
    return { item, batch, profile };
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    prisma = ctx.app.get(PrismaService);
    profiles = ctx.app.get(NutritionProfileService);
    resolver = ctx.app.get(FeedLotResolver);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
    });
    userId = user.id;
  }, 30_000);

  afterAll(async () => {
    await prisma.feedItemBatch.deleteMany({
      where: { feedItemId: { in: created.itemIds } },
    });
    await prisma.feedItem.deleteMany({
      where: { id: { in: created.itemIds } },
    });
    // Only profiles this run created — the RAKHAL-442 backfill profiles (same farm/creator) are
    // referenced by real batches and must never be touched.
    const mine = {
      farmId: owner.farmId,
      createdBy: userId,
      createdAt: { gte: startedAt },
    };
    await prisma.nutritionProfile.updateMany({
      where: mine,
      data: { supersedesId: null },
    });
    await prisma.nutritionProfile.deleteMany({ where: mine });
    await prisma.feedIngredient.deleteMany({
      where: { id: { in: created.ingredientIds } },
    });
    await ctx.app.close();
  });

  it('rejects an invalid profile with the list of problems and writes nothing', async () => {
    const before = await prisma.nutritionProfile.count({
      where: { farmId: owner.farmId },
    });
    await expect(
      profiles.create(owner.farmId, userId, {
        values: { ...hayValues(), cpPct: 200 },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      await prisma.nutritionProfile.count({ where: { farmId: owner.farmId } }),
    ).toBe(before);
  });

  it('editing appends a superseding row, repoints the batch and moves the default', async () => {
    const { item, batch, profile } = await makeItemWithBatch('E2E Hay');

    const { profile: next } = await profiles.reviseBatch(
      owner.farmId,
      userId,
      batch.id,
      { values: { ...hayValues(), cpPct: 12 } },
    );

    expect(next.id).not.toBe(profile.id);
    expect(next.supersedesId).toBe(profile.id);
    expect(next.cpPct).toBe(12);
    // The old row is untouched (immutable).
    expect(
      (
        await prisma.nutritionProfile.findUniqueOrThrow({
          where: { id: profile.id },
        })
      ).cpPct,
    ).toBe(9);
    const after = await prisma.feedItemBatch.findUniqueOrThrow({
      where: { id: batch.id },
    });
    expect(after.nutritionProfileId).toBe(next.id);
    expect(
      (await prisma.feedItem.findUniqueOrThrow({ where: { id: item.id } }))
        .defaultNutritionProfileId,
    ).toBe(next.id);

    const history = await profiles.history(owner.farmId, next.id);
    expect(history.map((h) => h.id)).toEqual([next.id, profile.id]);
  });

  it('revert appends a copy of the previous values and cannot revert a first profile', async () => {
    const { batch } = await makeItemWithBatch('E2E Revert');
    await expect(
      profiles.revertBatch(owner.farmId, userId, batch.id),
    ).rejects.toBeInstanceOf(BadRequestException);

    await profiles.reviseBatch(owner.farmId, userId, batch.id, {
      values: { ...hayValues(), cpPct: 14 },
    });
    const { profile: reverted } = await profiles.revertBatch(
      owner.farmId,
      userId,
      batch.id,
    );
    expect(reverted.cpPct).toBe(9);
    const history = await profiles.history(owner.farmId, reverted.id);
    expect(history).toHaveLength(3);
  });

  it('rejects a stale edit (optimistic concurrency)', async () => {
    const { batch } = await makeItemWithBatch('E2E Concurrency');
    const stale = batch.updatedAt.toISOString();
    await profiles.reviseBatch(owner.farmId, userId, batch.id, {
      values: { ...hayValues(), cpPct: 10 },
    });
    await expect(
      profiles.reviseBatch(owner.farmId, userId, batch.id, {
        values: { ...hayValues(), cpPct: 11 },
        expectedUpdatedAt: stale,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks nutrition edits on an archived feed item', async () => {
    const { item, batch } = await makeItemWithBatch('E2E Archived');
    await prisma.feedItem.update({
      where: { id: item.id },
      data: { deletedAt: new Date() },
    });
    await expect(
      profiles.reviseBatch(owner.farmId, userId, batch.id, {
        values: { ...hayValues(), cpPct: 10 },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('copies a catalogue ingredient once, keeps unmeasured nutrients null, flags drift and re-syncs', async () => {
    const ingredient = await prisma.feedIngredient.create({
      data: {
        nameEn: `E2E Catalogue ${Date.now()}-${Math.random()}`,
        feedClass: 'CONCENTRATE',
        dmPct: 90,
        cpPct: 22,
        meMjPerKgDm: 12,
        currentPricePerKg: 30,
        farmId: owner.farmId,
      },
    });
    created.ingredientIds.push(ingredient.id);

    const copy = await profiles.createFromIngredient(
      owner.farmId,
      userId,
      ingredient.id,
    );
    expect(copy.cpPct).toBe(22);
    expect(copy.fatPct).toBeNull(); // not measured stays null, not 0
    expect(copy.copiedFromIngredientId).toBe(ingredient.id);
    expect(await profiles.differsFromCatalogue(owner.farmId, copy)).toEqual([]);

    // A farm override later changes the catalogue value -> the copy now "differs".
    await prisma.feedIngredientOverride.create({
      data: {
        farmId: owner.farmId,
        ingredientId: ingredient.id,
        customCpPct: 25,
        createdBy: userId,
      },
    });
    expect(await profiles.differsFromCatalogue(owner.farmId, copy)).toEqual([
      'cpPct',
    ]);

    // Re-sync through a batch appends a new profile that matches again.
    const item = await prisma.feedItem.create({
      data: {
        farmId: owner.farmId,
        name: `E2E Resync ${Date.now()}-${Math.random()}`,
        feedClass: 'CONCENTRATE',
        unitId: 'unit_kg',
        costPerUnit: 30,
        purchaseDate: new Date(),
        createdBy: userId,
        ingredientId: ingredient.id,
      },
    });
    created.itemIds.push(item.id);
    const batch = await prisma.feedItemBatch.create({
      data: {
        feedItemId: item.id,
        farmId: owner.farmId,
        costPerUnit: 30,
        purchaseDate: new Date(),
        nutritionProfileId: copy.id,
        createdBy: userId,
      },
    });
    const { profile: synced } = await profiles.resyncBatch(
      owner.farmId,
      userId,
      batch.id,
    );
    expect(synced.cpPct).toBe(25);
    expect(await profiles.differsFromCatalogue(owner.farmId, synced)).toEqual(
      [],
    );

    await prisma.feedIngredientOverride.deleteMany({
      where: { ingredientId: ingredient.id },
    });
  });

  it('a hand-typed profile has nothing to compare and cannot be re-synced', async () => {
    const { batch, profile } = await makeItemWithBatch('E2E Manual');
    expect(
      await profiles.differsFromCatalogue(owner.farmId, profile),
    ).toBeNull();
    await expect(
      profiles.resyncBatch(owner.farmId, userId, batch.id),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('is farm-scoped: another farm cannot resolve the profile', async () => {
    const { profile } = await makeItemWithBatch('E2E Scope');
    expect(
      (await resolver.profiles(owner.farmId, [profile.id])).has(profile.id),
    ).toBe(true);
    expect(
      (await resolver.profiles('some-other-farm', [profile.id])).size,
    ).toBe(0);
  });

  it('effectiveIngredients keeps formula-math parity (unmeasured optionals coerce to 0)', async () => {
    const ingredient = await prisma.feedIngredient.create({
      data: {
        nameEn: `E2E Parity ${Date.now()}-${Math.random()}`,
        feedClass: 'FORAGE',
        dmPct: 30,
        cpPct: 8,
        meMjPerKgDm: 9,
        currentPricePerKg: 4,
        farmId: owner.farmId,
      },
    });
    created.ingredientIds.push(ingredient.id);
    const map = await resolver.effectiveIngredients(owner.farmId, [
      ingredient.id,
      ingredient.id,
    ]);
    const eff = map.get(ingredient.id);
    expect(eff?.cpPct).toBe(8);
    expect(eff?.fatPct).toBe(0);
    expect(map.size).toBe(1);
    expect((await resolver.effectiveIngredients(owner.farmId, [])).size).toBe(
      0,
    );
  });
});
