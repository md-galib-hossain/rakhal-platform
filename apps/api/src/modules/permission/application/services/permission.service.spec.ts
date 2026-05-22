import { ForbiddenException } from '@nestjs/common';
import { PermissionService } from './permission.service';

describe('PermissionService', () => {
  let prisma: {
    farmMember: { findUnique: jest.Mock };
  };
  let redis: {
    get: jest.Mock;
    set: jest.Mock;
    keys: jest.Mock;
    del: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      farmMember: { findUnique: jest.fn() },
    };
    redis = {
      get: jest.fn(),
      set: jest.fn(),
      keys: jest.fn(),
      del: jest.fn(),
    };
  });

  it('resolves and caches permissions', async () => {
    redis.get.mockResolvedValue(null);
    prisma.farmMember.findUnique.mockResolvedValue({
      role: {
        permissions: [
          { permission: { key: 'milk.read' } },
          { permission: { key: 'milk.write' } },
        ],
      },
    });

    const service = new PermissionService(
      prisma as never,
      redis as never,
      { setContext: jest.fn().mockReturnThis(), warn: jest.fn() } as never,
    );

    await expect(
      service.resolvePermissions('user-1', 'farm-1', 1),
    ).resolves.toEqual(['milk.read', 'milk.write']);
    expect(redis.set).toHaveBeenCalled();
  });

  it('rejects when membership is missing', async () => {
    redis.get.mockResolvedValue(null);
    prisma.farmMember.findUnique.mockResolvedValue(null);

    const service = new PermissionService(
      prisma as never,
      redis as never,
      { setContext: jest.fn().mockReturnThis(), warn: jest.fn() } as never,
    );

    await expect(
      service.resolvePermissions('user-1', 'farm-1', 1),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows exact permission matches', async () => {
    redis.get.mockResolvedValue(null);
    prisma.farmMember.findUnique.mockResolvedValue({
      role: {
        permissions: [{ permission: { key: 'cattle.read' } }],
      },
    });

    const service = new PermissionService(
      prisma as never,
      redis as never,
      { setContext: jest.fn().mockReturnThis(), warn: jest.fn() } as never,
    );

    await expect(
      service.hasPermission('user-1', 'farm-1', 1, ['cattle.read']),
    ).resolves.toBe(true);
  });

  it('allows wildcard resource matches', async () => {
    redis.get.mockResolvedValue(null);
    prisma.farmMember.findUnique.mockResolvedValue({
      role: {
        permissions: [{ permission: { key: 'cattle.*' } }],
      },
    });

    const service = new PermissionService(
      prisma as never,
      redis as never,
      { setContext: jest.fn().mockReturnThis(), warn: jest.fn() } as never,
    );

    await expect(
      service.hasPermission('user-1', 'farm-1', 1, ['cattle.update']),
    ).resolves.toBe(true);
  });

  it('allows global wildcard matches', async () => {
    redis.get.mockResolvedValue(null);
    prisma.farmMember.findUnique.mockResolvedValue({
      role: {
        permissions: [{ permission: { key: '*' } }],
      },
    });

    const service = new PermissionService(
      prisma as never,
      redis as never,
      { setContext: jest.fn().mockReturnThis(), warn: jest.fn() } as never,
    );

    await expect(
      service.hasPermission('user-1', 'farm-1', 1, ['finance.view']),
    ).resolves.toBe(true);
  });

  it('denies when required permission is not matched', async () => {
    redis.get.mockResolvedValue(null);
    prisma.farmMember.findUnique.mockResolvedValue({
      role: {
        permissions: [{ permission: { key: 'milk.read' } }],
      },
    });

    const service = new PermissionService(
      prisma as never,
      redis as never,
      { setContext: jest.fn().mockReturnThis(), warn: jest.fn() } as never,
    );

    await expect(
      service.hasPermission('user-1', 'farm-1', 1, ['cattle.read']),
    ).resolves.toBe(false);
  });
});
