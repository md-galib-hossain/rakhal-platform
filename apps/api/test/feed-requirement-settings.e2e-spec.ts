import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';
import { currentTotpCode } from './utils/totp';
import { DEFAULT_REQUIREMENT_SETTINGS } from '../src/modules/feed/domain/requirement-settings';
import { RequirementSettingsService } from '../src/modules/feed/application/services/requirement-settings.service';
import { concentrateDerivedIngredientId } from './utils/feed';

/**
 * Requirement settings as data — both surfaces (RAKHAL-409 farm, RAKHAL-410 admin;
 * PRD §12.13 / §19.4).
 *
 * Proves the seam end to end: the resolution order (farm changes -> active preset ->
 * built-in defaults), that a change on either layer actually moves
 * `GET /feed/requirements`, that a reset restores the standard model, that an activated
 * preset is immutable, and that a farm token cannot reach the admin surface.
 *
 * The migration-safety property is asserted explicitly: with no preset published and no
 * farm changes, a farm resolves exactly the built-in defaults, so shipping this feature
 * changed no farm's numbers.
 *
 * **Both surfaces live in one spec file deliberately.** A `RequirementPreset` is global
 * and `FarmRequirementSettings` is one row per farm, so two spec files exercising this
 * feature fight over the same state — Jest runs files in parallel workers but tests within
 * a file serially. Splitting them was tried and produced exactly that flake: a published
 * preset broke the other file's "nothing published" assertions.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Requirement settings (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let settingsService: RequirementSettingsService;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let adminToken: string;
  /** RAKHAL-425: `createRation()`'s TMR needs one line using this. */
  let concentrateIngredientId: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const adminAuth = (): [string, string] => [
    'Authorization',
    `Bearer ${adminToken}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const presetName = `E2E Requirement Preset ${Date.now()}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    settingsService = ctx.app.get(RequirementSettingsService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
    concentrateIngredientId = await concentrateDerivedIngredientId(ctx, owner);

    const login = await request(server())
      .post(api('/admin/auth/login'))
      .send({
        email: 'admin@rakhal.test',
        password: 'AdminPass123',
        code: currentTotpCode(),
      })
      .expect(201);
    adminToken = (login.body as { data: { accessToken: string } }).data
      .accessToken;

    await clearEverything();
  }, 30_000);

  afterAll(async () => {
    await clearEverything();
    await ctx.app.close();
  });

  /**
   * Clear both layers straight through Prisma. These writes bypass the routes that
   * normally invalidate the cache, so the cache has to be cleared explicitly. An active
   * preset is global, so leaving one behind would change every other suite's numbers.
   */
  async function clearEverything() {
    await prisma.farmRequirementSettings.deleteMany({
      where: { farmId: owner.farmId },
    });
    await prisma.requirementPreset.deleteMany({
      where: { name: { startsWith: 'E2E Requirement Preset' } },
    });
    await settingsService.invalidateAll();
  }

  /** Crude protein for a fixed cow — the number a settings change must be able to move. */
  async function proteinForFixedCow(): Promise<number> {
    const res = await request(server())
      .get(api('/feed/requirements'))
      .set(...auth(owner))
      .query({ weightKg: 450, milkTargetL: 15 })
      .expect(200);
    return res.body.data.requirements.cp_kg as number;
  }

  // ===========================================================================
  // Farm surface (RAKHAL-409)
  // ===========================================================================

  describe('with nothing published and no farm changes', () => {
    beforeEach(clearEverything);

    it('resolves exactly the built-in defaults, so shipping this changed no farm numbers', async () => {
      const res = await request(server())
        .get(api('/feed/requirement-settings'))
        .set(...auth(owner))
        .expect(200);

      expect(res.body.data.effective).toEqual(DEFAULT_REQUIREMENT_SETTINGS);
      expect(res.body.data.preset).toBeNull();
      expect(res.body.data.farm_changes).toEqual({});
    });

    it('reports every field as coming from the built-in defaults', async () => {
      const res = await request(server())
        .get(api('/feed/requirement-settings'))
        .set(...auth(owner))
        .expect(200);

      const sources: Record<string, string> = res.body.data.sources;
      expect(Object.keys(sources)).toHaveLength(
        Object.keys(DEFAULT_REQUIREMENT_SETTINGS).length,
      );
      expect(new Set(Object.values(sources))).toEqual(new Set(['default']));
    });

    it('returns the field metadata an editor needs to render the form', async () => {
      const res = await request(server())
        .get(api('/feed/requirement-settings'))
        .set(...auth(owner))
        .expect(200);

      const field = res.body.data.fields.proteinPerLitreMilk;
      expect(field).toMatchObject({ group: 'protein', unit: 'g / L' });
      expect(field.label).toBeTruthy();
      expect(field.min).toBeLessThan(field.max);
    });
  });

  describe('farm changes', () => {
    beforeEach(clearEverything);
    afterEach(clearEverything);

    it('stores only the fields supplied and leaves the rest inherited', async () => {
      const res = await request(server())
        .put(api('/feed/requirement-settings'))
        .set(...auth(owner))
        .send({ changes: { proteinPerLitreMilk: 90 }, notes: 'e2e' })
        .expect(200);

      expect(res.body.data.farm_changes).toEqual({ proteinPerLitreMilk: 90 });
      expect(res.body.data.effective.proteinPerLitreMilk).toBe(90);
      expect(res.body.data.effective.energyPerLitreMilk).toBe(
        DEFAULT_REQUIREMENT_SETTINGS.energyPerLitreMilk,
      );
      expect(res.body.data.sources.proteinPerLitreMilk).toBe('farm');
      expect(res.body.data.sources.energyPerLitreMilk).toBe('default');
    });

    it('actually moves the number GET /feed/requirements returns', async () => {
      const before = await proteinForFixedCow();

      await request(server())
        .put(api('/feed/requirement-settings'))
        .set(...auth(owner))
        .send({ changes: { proteinPerLitreMilk: 170 } })
        .expect(200);

      // Double the per-litre protein across 15 L is a change no rounding can hide.
      expect(await proteinForFixedCow()).toBeGreaterThan(before);
    });

    it('restores the standard model on reset', async () => {
      const before = await proteinForFixedCow();

      await request(server())
        .put(api('/feed/requirement-settings'))
        .set(...auth(owner))
        .send({ changes: { proteinPerLitreMilk: 170 } })
        .expect(200);
      expect(await proteinForFixedCow()).toBeGreaterThan(before);

      const reset = await request(server())
        .delete(api('/feed/requirement-settings'))
        .set(...auth(owner))
        .expect(200);

      expect(reset.body.data.farm_changes).toEqual({});
      expect(await proteinForFixedCow()).toBeCloseTo(before, 2);
    });

    it('replaces the previous change set rather than accumulating', async () => {
      await request(server())
        .put(api('/feed/requirement-settings'))
        .set(...auth(owner))
        .send({ changes: { proteinPerLitreMilk: 90 } })
        .expect(200);

      const res = await request(server())
        .put(api('/feed/requirement-settings'))
        .set(...auth(owner))
        .send({ changes: { targetBodyCondition: 3.25 } })
        .expect(200);

      expect(res.body.data.farm_changes).toEqual({ targetBodyCondition: 3.25 });
      expect(res.body.data.effective.proteinPerLitreMilk).toBe(
        DEFAULT_REQUIREMENT_SETTINGS.proteinPerLitreMilk,
      );
    });

    it('rejects an out-of-range value and names the field', async () => {
      const res = await request(server())
        .put(api('/feed/requirement-settings'))
        .set(...auth(owner))
        .send({ changes: { proteinPerLitreMilk: 99999 } })
        .expect(400);

      expect(JSON.stringify(res.body)).toContain('proteinPerLitreMilk');
    });

    it('rejects an unknown field rather than storing it', async () => {
      await request(server())
        .put(api('/feed/requirement-settings'))
        .set(...auth(owner))
        .send({ changes: { dmiFcmCoef: 0.4 } })
        .expect(400);

      const res = await request(server())
        .get(api('/feed/requirement-settings'))
        .set(...auth(owner))
        .expect(200);
      expect(res.body.data.farm_changes).toEqual({});
    });
  });

  describe('farm permissions', () => {
    it('lets a worker read them (feed.read, RAKHAL-427)', async () => {
      await request(server())
        .get(api('/feed/requirement-settings'))
        .set(...auth(worker))
        .expect(200);
    });

    it('stops a worker changing them', async () => {
      await request(server())
        .put(api('/feed/requirement-settings'))
        .set(...auth(worker))
        .send({ changes: { proteinPerLitreMilk: 90 } })
        .expect(403);
    });

    it('stops a worker resetting them', async () => {
      await request(server())
        .delete(api('/feed/requirement-settings'))
        .set(...auth(worker))
        .expect(403);
    });

    it('rejects an unauthenticated caller', async () => {
      await request(server())
        .get(api('/feed/requirement-settings'))
        .expect(401);
    });
  });

  // ===========================================================================
  // Admin surface (RAKHAL-410)
  // ===========================================================================

  describe('admin presets', () => {
    beforeEach(clearEverything);
    afterEach(clearEverything);

    async function createPreset(settings: Record<string, unknown>) {
      const res = await request(server())
        .post(api('/admin/requirement-presets'))
        .set(...adminAuth())
        .send({ name: presetName, settings })
        .expect(201);
      return res.body.data;
    }

    async function activate(presetId: string) {
      return request(server())
        .post(api(`/admin/requirement-presets/${presetId}/activate`))
        .set(...adminAuth())
        .expect(201);
    }

    it('keeps a farm token out of the admin preset routes', async () => {
      await request(server())
        .get(api('/admin/requirement-presets'))
        .set(...auth(owner))
        .expect(401);
    });

    it('rejects an unauthenticated caller', async () => {
      await request(server())
        .get(api('/admin/requirement-presets'))
        .expect(401);
    });

    it('lists presets alongside the built-in defaults, so a candidate can be diffed', async () => {
      const res = await request(server())
        .get(api('/admin/requirement-presets'))
        .set(...adminAuth())
        .expect(200);

      expect(res.body.data.built_in_defaults).toEqual(
        DEFAULT_REQUIREMENT_SETTINGS,
      );
      expect(res.body.data.fields.proteinPerLitreMilk).toMatchObject({
        group: 'protein',
      });
      expect(Array.isArray(res.body.data.presets)).toBe(true);
    });

    it('creates a preset inactive, so it can be reviewed before it reaches any farm', async () => {
      const preset = await createPreset({ proteinPerLitreMilk: 88 });

      expect(preset.is_active).toBe(false);
      expect(preset.settings).toEqual({ proteinPerLitreMilk: 88 });
      // `effective` shows what a farm would get: this field changed, the rest inherited.
      expect(preset.effective.proteinPerLitreMilk).toBe(88);
      expect(preset.effective.energyPerLitreMilk).toBe(
        DEFAULT_REQUIREMENT_SETTINGS.energyPerLitreMilk,
      );
    });

    it('does not change any farm until it is activated', async () => {
      const before = await proteinForFixedCow();
      await createPreset({ proteinPerLitreMilk: 170 });
      expect(await proteinForFixedCow()).toBeCloseTo(before, 2);
    });

    it('rejects a preset with an out-of-range value, naming the field', async () => {
      const res = await request(server())
        .post(api('/admin/requirement-presets'))
        .set(...adminAuth())
        .send({ name: `${presetName} bad`, settings: { tdnShareOfIntake: 42 } })
        .expect(400);

      expect(JSON.stringify(res.body)).toContain('tdnShareOfIntake');
    });

    it('versions each preset of the same name rather than overwriting', async () => {
      const first = await createPreset({ proteinPerLitreMilk: 86 });
      const second = await createPreset({ proteinPerLitreMilk: 87 });
      expect(second.version).toBe(first.version + 1);
    });

    it('becomes the base layer on activation, invalidating the cache immediately', async () => {
      const before = await proteinForFixedCow();
      const preset = await createPreset({ proteinPerLitreMilk: 170 });

      const activated = await activate(preset.id);
      expect(activated.body.data.is_active).toBe(true);

      const res = await request(server())
        .get(api('/feed/requirement-settings'))
        .set(...auth(owner))
        .expect(200);
      expect(res.body.data.preset).toMatchObject({ name: presetName });
      expect(res.body.data.sources.proteinPerLitreMilk).toBe('preset');
      // A preset supplies only what it names; everything else still falls through.
      expect(res.body.data.sources.energyPerLitreMilk).toBe('default');

      // No waiting for a TTL — activation drops every farm's cached settings.
      expect(await proteinForFixedCow()).toBeGreaterThan(before);
    });

    it('leaves exactly one preset active when another is activated', async () => {
      const first = await createPreset({ proteinPerLitreMilk: 100 });
      const second = await createPreset({ proteinPerLitreMilk: 120 });

      await activate(first.id);
      await activate(second.id);

      const active = await prisma.requirementPreset.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe(second.id);
    });

    it('refuses to edit a preset once it is live', async () => {
      const preset = await createPreset({ proteinPerLitreMilk: 95 });

      await request(server())
        .patch(api(`/admin/requirement-presets/${preset.id}`))
        .set(...adminAuth())
        .send({ settings: { proteinPerLitreMilk: 96 } })
        .expect(200);

      await activate(preset.id);

      await request(server())
        .patch(api(`/admin/requirement-presets/${preset.id}`))
        .set(...adminAuth())
        .send({ settings: { proteinPerLitreMilk: 97 } })
        .expect(409);
    });

    it('writes an admin audit row naming the preset', async () => {
      const preset = await createPreset({ proteinPerLitreMilk: 91 });
      await activate(preset.id);

      const entry = await prisma.platformAdminAuditLog.findFirst({
        where: {
          entityType: 'RequirementPreset',
          entityId: preset.id,
          action: 'REQUIREMENT_PRESET_ACTIVATED',
        },
      });
      expect(entry).not.toBeNull();
    });

    it('is still outranked by a farm that set the same field itself', async () => {
      const preset = await createPreset({
        proteinPerLitreMilk: 170,
        targetBodyCondition: 3.5,
      });
      await activate(preset.id);

      const res = await request(server())
        .put(api('/feed/requirement-settings'))
        .set(...auth(owner))
        .send({ changes: { proteinPerLitreMilk: 100 } })
        .expect(200);

      expect(res.body.data.effective.proteinPerLitreMilk).toBe(100);
      expect(res.body.data.sources.proteinPerLitreMilk).toBe('farm');
      // Untouched by the farm, so the preset still wins over the built-in default.
      expect(res.body.data.effective.targetBodyCondition).toBe(3.5);
      expect(res.body.data.sources.targetBodyCondition).toBe('preset');
    });

    it('degrades to the defaults for a field it stored badly, instead of failing the request', async () => {
      // Written straight to the DB: the API would reject this, but a row written by a
      // different engine revision could still hold a field this build rejects.
      await prisma.requirementPreset.create({
        data: {
          name: presetName,
          version: 99,
          settings: { proteinPerLitreMilk: 99999, targetBodyCondition: 3.5 },
          isActive: true,
        },
      });
      await settingsService.invalidateAll();

      const res = await request(server())
        .get(api('/feed/requirement-settings'))
        .set(...auth(owner))
        .expect(200);

      expect(res.body.data.effective.proteinPerLitreMilk).toBe(
        DEFAULT_REQUIREMENT_SETTINGS.proteinPerLitreMilk,
      );
      expect(res.body.data.effective.targetBodyCondition).toBe(3.5);
    });

    it('404s an unknown preset', async () => {
      await request(server())
        .post(api('/admin/requirement-presets/does-not-exist/activate'))
        .set(...adminAuth())
        .expect(404);
    });

    it('shows an admin what one farm has changed', async () => {
      await request(server())
        .put(api('/feed/requirement-settings'))
        .set(...auth(owner))
        .send({ changes: { targetBodyCondition: 3.25 } })
        .expect(200);

      const res = await request(server())
        .get(api(`/admin/requirement-presets/farms/${owner.farmId}`))
        .set(...adminAuth())
        .expect(200);

      expect(res.body.data.farm_changes).toEqual({ targetBodyCondition: 3.25 });
    });
  });
  // ===========================================================================
  // Saved rations read through the same seam (RAKHAL-411)
  // ===========================================================================

  describe('saved rations', () => {
    beforeEach(clearEverything);
    afterEach(clearEverything);

    /** A Total Mixed Ration with a stored target, so it carries a requirement block. */
    async function createRation() {
      const ingredients = await request(server())
        .get(api('/feed/ingredients'))
        .set(...auth(owner))
        .expect(200);
      const first = (ingredients.body.data.items ?? ingredients.body.data)[0];

      const res = await request(server())
        .post(api('/feed/concentrations'))
        .set(...auth(owner))
        .send({
          kind: 'FEED_MIXTURE',
          name: `E2E Requirement Ration ${Date.now()}`,
          targetType: 'HERD',
          durationDays: 30,
          targetWeightKg: 450,
          targetMilkL: 15,
          items: [
            { ingredientId: first.id, amountKg: 10 },
            { ingredientId: concentrateIngredientId, amountKg: 0 },
          ],
        })
        .expect(201);
      return res.body.data;
    }

    it('scores a saved ration against the farm own tuned model, not the built-in defaults', async () => {
      const ration = await createRation();
      const before = ration.requirements.cp_kg as number;

      await request(server())
        .put(api('/feed/requirement-settings'))
        .set(...auth(owner))
        .send({ changes: { proteinPerLitreMilk: 170 } })
        .expect(200);

      const after = await request(server())
        .get(api(`/feed/concentrations/${ration.id}`))
        .set(...auth(owner))
        .expect(200);

      // Before RAKHAL-411 this stayed at the default-model number: `enrich()` called the
      // domain function directly and never saw the farm's settings.
      expect(after.body.data.requirements.cp_kg).toBeGreaterThan(before);

      await request(server())
        .delete(api(`/feed/concentrations/${ration.id}`))
        .set(...auth(owner));
    });

    it('leaves a Concentrate Mixer template without a requirement, as before', async () => {
      const ingredients = await request(server())
        .get(api('/feed/ingredients'))
        .set(...auth(owner))
        .expect(200);
      const first = (ingredients.body.data.items ?? ingredients.body.data)[0];

      const res = await request(server())
        .post(api('/feed/concentrations'))
        .set(...auth(owner))
        .send({
          kind: 'CONCENTRATE_TEMPLATE',
          name: `E2E Requirement Template ${Date.now()}`,
          targetType: 'HERD',
          items: [{ ingredientId: first.id, amountKg: 10 }],
        })
        .expect(201);

      expect(res.body.data.requirements).toBeNull();
      expect(res.body.data.balance_score).toBeNull();

      await request(server())
        .delete(api(`/feed/concentrations/${res.body.data.id}`))
        .set(...auth(owner));
    });
  });
  // ===========================================================================
  // Today's requirement no longer depends on having a ration (RAKHAL-412)
  // ===========================================================================

  describe("today's requirement", () => {
    it('returns what the herd needs from live cattle records, with a per-group breakdown', async () => {
      const res = await request(server())
        .get(api('/feed/today-requirement'))
        .set(...auth(owner))
        .expect(200);

      // The demo farm has cattle, so there must be a real requirement regardless of
      // whether any Total Mixed Ration exists — this is the dead end RAKHAL-412 removes.
      expect(res.body.data.requirement).not.toBeNull();
      expect(res.body.data.requirement.headcount).toBeGreaterThan(0);
      expect(res.body.data.requirement.per_cow.dm_kg).toBeGreaterThan(0);
      expect(res.body.data.requirement.herd_total.dm_kg).toBeGreaterThan(
        res.body.data.requirement.per_cow.dm_kg,
      );
      expect(res.body.data.requirement.data_source.weight).toBe(
        'cattle_record_avg',
      );
      expect(Array.isArray(res.body.data.by_group_requirement)).toBe(true);
      expect(typeof res.body.data.has_active_ration).toBe('boolean');
    });

    it('reports the herd requirement through the farm own tuned model', async () => {
      const before = await request(server())
        .get(api('/feed/today-requirement'))
        .set(...auth(owner))
        .expect(200);

      // A maintenance term, not a per-litre one: the demo herd's 7-day average yield can
      // legitimately be zero, in which case `proteinPerLitreMilk` moves nothing and the
      // assertion would prove nothing.
      await request(server())
        .put(api('/feed/requirement-settings'))
        .set(...auth(owner))
        .send({ changes: { maintenanceProteinPerMetabolicKg: 7.6 } })
        .expect(200);

      const after = await request(server())
        .get(api('/feed/today-requirement'))
        .set(...auth(owner))
        .expect(200);

      expect(after.body.data.requirement.per_cow.cp_kg).toBeGreaterThan(
        before.body.data.requirement.per_cow.cp_kg,
      );

      await request(server())
        .delete(api('/feed/requirement-settings'))
        .set(...auth(owner))
        .expect(200);
    });
  });
});
