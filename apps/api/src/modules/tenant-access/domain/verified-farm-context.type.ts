import { FarmStatus } from '@prisma/client';

export interface VerifiedFarmContext {
  farmId: string;
  farmName: string;
  farmSlug: string;
  farmStatus: FarmStatus;
  membershipId: string;
  roleId: string;
  roleName: string;
  isSystemRole: boolean;
}
