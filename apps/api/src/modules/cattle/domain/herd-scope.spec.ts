import { HerdStatus } from '@prisma/client';
import { activeHerd, notDeleted, anyRecord } from './herd-scope';

describe('herd-scope', () => {
  const farmId = 'farm-1';

  it('activeHerd scopes to ACTIVE and not deleted', () => {
    expect(activeHerd(farmId)).toEqual({
      farmId,
      herdStatus: HerdStatus.ACTIVE,
      deletedAt: null,
    });
  });

  it('notDeleted scopes to not deleted regardless of herdStatus', () => {
    expect(notDeleted(farmId)).toEqual({ farmId, deletedAt: null });
  });

  it('anyRecord scopes to the farm only', () => {
    expect(anyRecord(farmId)).toEqual({ farmId });
  });
});
