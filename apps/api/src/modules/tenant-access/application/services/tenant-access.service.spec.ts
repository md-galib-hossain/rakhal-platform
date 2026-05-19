import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FarmStatus } from '@prisma/client';
import { TenantAccessService } from './tenant-access.service';

describe('TenantAccessService', () => {
  let prisma: {
    farm: { findUnique: jest.Mock };
    farmMember: { findUnique: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      farm: { findUnique: jest.fn() },
      farmMember: { findUnique: jest.fn() },
    };
  });

  it('returns a verified farm context for an active member', async () => {
    prisma.farm.findUnique.mockResolvedValue({
      id: 'farm-1',
      name: 'Farm One',
      slug: 'farm-one',
      status: FarmStatus.ACTIVE,
      deletedAt: null,
    });
    prisma.farmMember.findUnique.mockResolvedValue({
      id: 'member-1',
      roleId: 'role-1',
      role: {
        id: 'role-1',
        name: 'Caretaker',
        isSystemRole: false,
      },
    });

    const service = new TenantAccessService(
      prisma as never,
      { setContext: jest.fn().mockReturnThis(), warn: jest.fn() } as never,
    );

    await expect(
      service.resolveFarmContext('user-1', 'farm-1'),
    ).resolves.toEqual(
      expect.objectContaining({
        farmId: 'farm-1',
        membershipId: 'member-1',
        roleId: 'role-1',
      }),
    );
  });

  it('rejects when the farm does not exist', async () => {
    prisma.farm.findUnique.mockResolvedValue(null);

    const service = new TenantAccessService(
      prisma as never,
      { setContext: jest.fn().mockReturnThis(), warn: jest.fn() } as never,
    );

    await expect(
      service.resolveFarmContext('user-1', 'farm-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects when membership is missing', async () => {
    prisma.farm.findUnique.mockResolvedValue({
      id: 'farm-1',
      name: 'Farm One',
      slug: 'farm-one',
      status: FarmStatus.ACTIVE,
      deletedAt: null,
    });
    prisma.farmMember.findUnique.mockResolvedValue(null);

    const service = new TenantAccessService(
      prisma as never,
      { setContext: jest.fn().mockReturnThis(), warn: jest.fn() } as never,
    );

    await expect(
      service.resolveFarmContext('user-1', 'farm-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
