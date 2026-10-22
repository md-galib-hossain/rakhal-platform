import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AdminManagementService } from './admin-management.service';

/** Guard-rail logic only; persistence and audit are covered by test/admin-lifecycle.e2e-spec.ts. */
describe('AdminManagementService guard rails', () => {
  const superAdmin = {
    id: 'a1',
    email: 'a1@x.test',
    name: 'A1',
    role: 'SUPER_ADMIN',
    isActive: true,
    totpEnabled: true,
    mustChangePassword: false,
  };

  function build(otherActiveSupers: number, entity: unknown = superAdmin) {
    const prisma = {
      platformAdmin: {
        findUnique: jest.fn().mockResolvedValue(entity),
        count: jest.fn().mockResolvedValue(otherActiveSupers),
        update: jest.fn().mockResolvedValue({ ...superAdmin, isActive: false }),
      },
    };
    const sessions = { revokeAll: jest.fn() };
    const audit = { record: jest.fn() };
    const svc = new AdminManagementService(
      prisma as never,
      { hashPassword: jest.fn() } as never,
      sessions as never,
      audit as never,
    );
    return { svc, prisma, sessions, audit };
  }

  it('refuses to deactivate yourself', async () => {
    const { svc } = build(1);
    await expect(svc.deactivate('a1', 'a1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('refuses to deactivate the last active SUPER_ADMIN', async () => {
    const { svc, prisma } = build(0);
    await expect(svc.deactivate('other', 'a1')).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.platformAdmin.update).not.toHaveBeenCalled();
  });

  it('refuses to demote the last active SUPER_ADMIN', async () => {
    const { svc } = build(0);
    await expect(
      svc.update('other', 'a1', { role: 'SUPPORT_ADMIN' }),
    ).rejects.toThrow(ConflictException);
  });

  it('refuses to change your own role', async () => {
    const { svc } = build(3);
    await expect(
      svc.update('a1', 'a1', { role: 'SUPPORT_ADMIN' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('deactivating another SUPER_ADMIN works when another remains, and revokes sessions', async () => {
    const { svc, sessions, audit } = build(1);
    await svc.deactivate('other', 'a1');
    expect(sessions.revokeAll).toHaveBeenCalledWith('a1', 'ADMIN_DEACTIVATED');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ADMIN_DEACTIVATED',
        before: expect.objectContaining({ isActive: true }) as unknown,
        after: expect.objectContaining({ isActive: false }) as unknown,
      }),
    );
  });

  it('refuses self 2FA reset and self password reset', async () => {
    const { svc } = build(1);
    await expect(svc.resetTwoFactor('a1', 'a1')).rejects.toThrow(
      BadRequestException,
    );
    await expect(svc.resetPassword('a1', 'a1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('404s on an unknown admin', async () => {
    const { svc } = build(1, null);
    await expect(svc.activate('other', 'nope')).rejects.toThrow(
      NotFoundException,
    );
  });
});
