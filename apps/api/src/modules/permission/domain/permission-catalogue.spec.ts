import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  SYSTEM_ROLES,
} from './permission-catalogue';

/**
 * RAKHAL-353 — governance pass over the permission catalogue
 * (`FINANCE_V2_DESIGN.md` §4.2, §6). `finance.transfer`/`finance.reverse`
 * have no HTTP-level "Manager gets 403" e2e proof for `reverse` — no
 * controller exposes `JournalService.reverseJournal` yet (documented on the
 * catalogue's own `finance.reverse` entry) — so this is the real,
 * statically-checked proof that the *grant table itself* keeps both
 * owner-only, mirroring `finance.void`'s existing pattern exactly. Transfer's
 * own owner-only tier additionally has a live HTTP RBAC proof
 * (`test/finance-v2-transfers.e2e-spec.ts`); this spec is the always-run
 * regression guard for both, plus the new `sales`/`finance.accounts` keys.
 */
describe('permission-catalogue — RAKHAL-353 governance', () => {
  it('declares finance.reverse and finance.transfer in the full permission catalogue', () => {
    const keys = PERMISSIONS.map((p) => p.key);
    expect(keys).toContain('finance.reverse');
    expect(keys).toContain('finance.transfer');
    expect(keys).toContain('finance.accounts');
    expect(keys).toContain('sales.update');
    expect(keys).toContain('sales.delete');
  });

  it('finance.transfer and finance.reverse are owner-only, mirroring finance.void', () => {
    const managerGrants = ROLE_PERMISSIONS[SYSTEM_ROLES.MANAGER];
    const workerGrants = ROLE_PERMISSIONS[SYSTEM_ROLES.WORKER];

    for (const sensitiveKey of [
      'finance.void',
      'finance.transfer',
      'finance.reverse',
    ]) {
      expect(managerGrants).not.toContain(sensitiveKey);
      expect(managerGrants).not.toContain('finance.*');
      expect(workerGrants).not.toContain(sensitiveKey);
      expect(workerGrants).not.toContain('finance.*');
    }

    // Owner grants '*' (global wildcard) — the only role that can reach
    // these two keys, exactly like finance.void today.
    expect(ROLE_PERMISSIONS[SYSTEM_ROLES.OWNER]).toEqual(['*']);
  });

  it('finance.accounts stays Owner+Manager (unchanged by this ticket) — only transfer/reverse were tightened', () => {
    const managerGrants = ROLE_PERMISSIONS[SYSTEM_ROLES.MANAGER];
    expect(managerGrants).toContain('finance.accounts');
  });

  it('sales.* (Manager) covers the new update/delete actions automatically — no explicit grant needed', () => {
    const managerGrants = ROLE_PERMISSIONS[SYSTEM_ROLES.MANAGER];
    expect(managerGrants).toContain('sales.*');
    const workerGrants = ROLE_PERMISSIONS[SYSTEM_ROLES.WORKER];
    expect(
      workerGrants.some((g) => g === 'sales.*' || g.startsWith('sales.')),
    ).toBe(false);
  });
});

describe('permission-catalogue — Reports v2 reports.delete', () => {
  it('declares reports.delete and keeps it Owner-only', () => {
    expect(PERMISSIONS.map((p) => p.key)).toContain('reports.delete');
    const manager = ROLE_PERMISSIONS[SYSTEM_ROLES.MANAGER];
    const worker = ROLE_PERMISSIONS[SYSTEM_ROLES.WORKER];
    expect(manager).not.toContain('reports.*');
    expect(manager).not.toContain('reports.delete');
    expect(worker.some((g) => g.startsWith('reports.'))).toBe(false);
    expect(manager).toEqual(
      expect.arrayContaining([
        'reports.read',
        'reports.create',
        'reports.schedule',
      ]),
    );
    expect(ROLE_PERMISSIONS[SYSTEM_ROLES.OWNER]).toEqual(['*']);
  });
});
