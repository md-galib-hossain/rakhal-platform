import { RequirePermission } from './require-permission.decorator';

export const Authorize = (...permissions: string[]) =>
  RequirePermission(...permissions);
