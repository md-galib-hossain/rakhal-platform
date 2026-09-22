import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Settings — Roles & Permissions (RAKHAL-413, covering the RAKHAL-031 backend).
 *
 * `POST/PATCH/DELETE /settings/roles` and `GET /settings/permissions` have been live since
 * RAKHAL-031 with no test coverage at all, and no frontend consumer either — so nothing
 * has ever exercised them. This spec closes that gap before RFE-101 builds the UI on top.
 *
 * The multi-tenant safety rule is the one worth pinning down: system roles are global
 * templates shared by every farm (`farmId = null`), so they are read-only here — editing
 * one would change permissions for every tenant. A farm customises by creating its own
 * role instead.
 *
 * Cleans up every role it creates: e2e suites run in parallel workers against one shared
 * dev DB, and a stray custom role would leak into other suites' role lists.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Settings — roles & permissions (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let manager: AuthedUser;
  let worker: AuthedUser;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const rolePrefix = `E2E Role ${Date.now()}`;
  const createdRoleIds: string[] = [];

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    manager = await loginAs(ctx, 'manager@demo.rakhal.test', 'ManagerPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
  }, 30_000);

  afterAll(async () => {
    for (const id of createdRoleIds) {
      await prisma.rolePermission.deleteMany({ where: { roleId: id } });
      await prisma.role.deleteMany({ where: { id } });
    }
    await ctx.app.close();
  });

  async function createRole(body: Record<string, unknown>) {
    const res = await request(server())
      .post(api('/settings/roles'))
      .set(...auth(owner))
      .send({
        name: `${rolePrefix} ${Math.random().toString(36).slice(2, 7)}`,
        ...body,
      })
      .expect(201);
    createdRoleIds.push(res.body.data.id as string);
    return res.body.data;
  }

  describe('the grantable catalogue', () => {
    it('lists permissions grouped by resource, with their actions', async () => {
      const res = await request(server())
        .get(api('/settings/permissions'))
        .set(...auth(owner))
        .expect(200);

      const catalogue = res.body.data.permissions;
      expect(Array.isArray(catalogue)).toBe(true);
      expect(catalogue.length).toBeGreaterThan(0);

      const cattle = catalogue.find(
        (c: { resource: string }) => c.resource === 'cattle',
      );
      expect(cattle).toBeDefined();
      expect(cattle.actions).toEqual(
        expect.arrayContaining(['read', 'create']),
      );
      expect(cattle.group).toBeTruthy();
    });
  });

  describe('listing roles', () => {
    it('returns only the Owner system template as read-only, with a populated matrix', async () => {
      const res = await request(server())
        .get(api('/settings/roles'))
        .set(...auth(owner))
        .expect(200);

      const roles = res.body.data.roles;
      const system = roles.filter((r: { is_system: boolean }) => r.is_system);
      // Manager/Worker are deliberately not listed: a farm only ever gets Owner for
      // free, everything else has to be a custom role the owner creates themselves.
      expect(system.map((r: { name: string }) => r.name).sort()).toEqual([
        'Owner',
      ]);

      for (const role of system) {
        expect(role.editable).toBe(false);
        expect(Array.isArray(role.permission_keys)).toBe(true);
        expect(role.matrix).toBeDefined();
      }

      // The catalogue rides along so an editor can render the grid from one response.
      expect(Array.isArray(res.body.data.catalogue)).toBe(true);
    });

    it('expands the Owner wildcard so the matrix shows what it actually grants', async () => {
      const res = await request(server())
        .get(api('/settings/roles'))
        .set(...auth(owner))
        .expect(200);

      const ownerRole = res.body.data.roles.find(
        (r: { name: string }) => r.name === 'Owner',
      );
      expect(ownerRole.permission_keys).toContain('*');
      // Stored as a single wildcard, but rendered as every concrete action.
      expect(ownerRole.matrix.cattle.read).toBe(true);
      expect(ownerRole.matrix.cattle.delete).toBe(true);
    });
  });

  describe('creating a custom role', () => {
    it('inherits the Worker template when a base role is given', async () => {
      const role = await createRole({ base_role: 'worker' });

      expect(role.is_system).toBe(false);
      expect(role.editable).toBe(true);
      expect(role.member_count).toBe(0);
      // Worker's own narrow grants: it can log a feed distribution but not read feed.
      expect(role.permission_keys).toContain('feed.distribution-log');
      expect(role.permission_keys).not.toContain('feed.read');
    });

    it('inherits the Manager template when asked for it', async () => {
      const fromWorker = await createRole({ base_role: 'worker' });
      const fromManager = await createRole({ base_role: 'manager' });

      expect(fromManager.permission_keys.length).toBeGreaterThan(
        fromWorker.permission_keys.length,
      );
    });

    it('takes an explicit permission list instead of a base role', async () => {
      const role = await createRole({
        permission_keys: ['cattle.read', 'milk.read'],
      });

      expect([...role.permission_keys].sort()).toEqual([
        'cattle.read',
        'milk.read',
      ]);
      expect(role.matrix.cattle.read).toBe(true);
      expect(role.matrix.cattle.delete).toBe(false);
    });

    it('rejects a reserved system role name', async () => {
      await request(server())
        .post(api('/settings/roles'))
        .set(...auth(owner))
        .send({ name: 'Owner', base_role: 'worker' })
        .expect(409);
    });

    it('rejects a reserved name regardless of casing', async () => {
      await request(server())
        .post(api('/settings/roles'))
        .set(...auth(owner))
        .send({ name: 'mAnAgEr', base_role: 'worker' })
        .expect(409);
    });

    it('rejects an unknown permission key and names it', async () => {
      const res = await request(server())
        .post(api('/settings/roles'))
        .set(...auth(owner))
        .send({
          name: `${rolePrefix} bad`,
          permission_keys: ['cattle.read', 'not.a.real.key'],
        })
        .expect(400);

      expect(JSON.stringify(res.body)).toContain('not.a.real.key');
    });

    it('rejects a duplicate name within the same farm', async () => {
      const name = `${rolePrefix} duplicate`;
      const first = await request(server())
        .post(api('/settings/roles'))
        .set(...auth(owner))
        .send({ name, base_role: 'worker' })
        .expect(201);
      createdRoleIds.push(first.body.data.id as string);

      await request(server())
        .post(api('/settings/roles'))
        .set(...auth(owner))
        .send({ name, base_role: 'worker' })
        .expect(409);
    });
  });

  describe('editing permissions', () => {
    it('replaces a custom role grant set wholesale', async () => {
      const role = await createRole({ permission_keys: ['cattle.read'] });

      const updated = await request(server())
        .patch(api(`/settings/roles/${role.id}/permissions`))
        .set(...auth(owner))
        .send({ permission_keys: ['milk.read', 'milk.create'] })
        .expect(200);

      // Replace, not merge — the previous grant is gone.
      expect([...updated.body.data.permission_keys].sort()).toEqual([
        'milk.create',
        'milk.read',
      ]);
      expect(updated.body.data.matrix.cattle.read).toBe(false);
    });

    it('refuses to edit a system role, because the template is shared by every farm', async () => {
      // Manager is intentionally no longer surfaced by GET /settings/roles (a farm
      // only gets Owner for free), so fetch its id straight from Prisma — the
      // read-only guard on a system role is still enforced by id regardless.
      const managerTemplate = await prisma.role.findFirstOrThrow({
        where: { name: 'Manager', isSystemRole: true },
        select: { id: true },
      });

      await request(server())
        .patch(api(`/settings/roles/${managerTemplate.id}/permissions`))
        .set(...auth(owner))
        .send({ permission_keys: ['cattle.read'] })
        .expect(403);
    });

    it('rejects an unknown key on update', async () => {
      const role = await createRole({ base_role: 'worker' });

      await request(server())
        .patch(api(`/settings/roles/${role.id}/permissions`))
        .set(...auth(owner))
        .send({ permission_keys: ['nope.nope'] })
        .expect(400);
    });

    it('404s an unknown role', async () => {
      await request(server())
        .patch(api('/settings/roles/does-not-exist/permissions'))
        .set(...auth(owner))
        .send({ permission_keys: ['cattle.read'] })
        .expect(404);
    });
  });

  describe('deleting a custom role', () => {
    it('deletes one that has no members', async () => {
      const role = await createRole({ base_role: 'worker' });

      await request(server())
        .delete(api(`/settings/roles/${role.id}`))
        .set(...auth(owner))
        .expect(200);

      const list = await request(server())
        .get(api('/settings/roles'))
        .set(...auth(owner))
        .expect(200);
      expect(
        list.body.data.roles.some((r: { id: string }) => r.id === role.id),
      ).toBe(false);
    });

    it('refuses while members are still assigned, and says how many', async () => {
      const role = await createRole({ base_role: 'worker' });

      // Park a real member on the role, then put them back.
      const member = await prisma.farmMember.findFirstOrThrow({
        where: { farmId: owner.farmId },
        select: { id: true, roleId: true },
      });
      await prisma.farmMember.update({
        where: { id: member.id },
        data: { roleId: role.id as string },
      });

      const res = await request(server())
        .delete(api(`/settings/roles/${role.id}`))
        .set(...auth(owner))
        .expect(400);
      expect(JSON.stringify(res.body)).toMatch(/member/i);

      await prisma.farmMember.update({
        where: { id: member.id },
        data: { roleId: member.roleId },
      });
    });

    it('refuses to delete a system role', async () => {
      // Same rationale as the edit-a-system-role test above: Worker no longer shows
      // up in the list response, so look its id up directly.
      const workerTemplate = await prisma.role.findFirstOrThrow({
        where: { name: 'Worker', isSystemRole: true },
        select: { id: true },
      });

      await request(server())
        .delete(api(`/settings/roles/${workerTemplate.id}`))
        .set(...auth(owner))
        .expect(403);
    });
  });

  describe('permissions on the routes themselves', () => {
    it('lets a manager read roles and the catalogue', async () => {
      await request(server())
        .get(api('/settings/roles'))
        .set(...auth(manager))
        .expect(200);
      await request(server())
        .get(api('/settings/permissions'))
        .set(...auth(manager))
        .expect(200);
    });

    it('stops a manager creating a role (settings.roles-manage is owner-only)', async () => {
      await request(server())
        .post(api('/settings/roles'))
        .set(...auth(manager))
        .send({ name: `${rolePrefix} by manager`, base_role: 'worker' })
        .expect(403);
    });

    it('stops a worker reading roles at all', async () => {
      await request(server())
        .get(api('/settings/roles'))
        .set(...auth(worker))
        .expect(403);
    });

    it('rejects an unauthenticated caller', async () => {
      await request(server()).get(api('/settings/roles')).expect(401);
    });
  });
});
